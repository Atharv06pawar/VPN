import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { wireguardManager } from '../../lib/wireguard.js';
import { appConfig } from '@bharattunnel/config';
import {
  CreateDeviceSchema,
  AUDIT_ACTIONS,
  DeviceInfo,
  WireGuardClientConfig,
} from '@bharattunnel/shared';
import { logger } from '../../lib/logger.js';
import { generateWireGuardClientConfig, generateQrCodeDataUrl } from '@bharattunnel/wireguard';

export const deviceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /api/devices - List user's devices
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.id;

    const devices = await prisma.device.findMany({
      where: { userId },
      include: { vpnPeer: true },
      orderBy: { createdAt: 'desc' },
    });

    const results: DeviceInfo[] = devices.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.name,
      status: d.status as any,
      tunnelIp: d.vpnPeer?.tunnelIp || 'Unassigned',
      publicKey: d.vpnPeer?.publicKey || '',
      createdAt: d.createdAt.toISOString(),
      revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
      lastHandshakeAt: d.vpnPeer?.latestHandshakeAt ? d.vpnPeer.latestHandshakeAt.toISOString() : null,
      bytesRx: Number(d.vpnPeer?.bytesRx || 0n),
      bytesTx: Number(d.vpnPeer?.bytesTx || 0n),
    }));

    return reply.send({ success: true, data: results });
  });

  // POST /api/devices - Add a new device & provision WireGuard peer
  fastify.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const input = CreateDeviceSchema.parse(request.body);

    // Enforce device quota limit
    const activeDeviceCount = await prisma.device.count({
      where: { userId, status: 'ACTIVE' },
    });

    if (activeDeviceCount >= appConfig.MAX_DEVICES_PER_USER) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'DEVICE_LIMIT_REACHED',
          message: `Maximum active devices (${appConfig.MAX_DEVICES_PER_USER}) reached. Please revoke an existing device first.`,
        },
      });
    }

    // Retrieve all currently allocated IPs across the fleet
    const activeAllocations = await prisma.ipAllocation.findMany({
      where: { status: 'ALLOCATED' },
      select: { ipAddress: true },
    });
    const allocatedIps = activeAllocations.map((a) => a.ipAddress);

    // Create device placeholder to obtain ID
    const newDeviceId = crypto.randomUUID();

    let provisionResult;
    try {
      provisionResult = await wireguardManager.provisionPeer({
        deviceId: newDeviceId,
        deviceName: input.name,
        clientPublicKey: input.publicKey,
        existingAllocatedIps: allocatedIps,
      });
    } catch (err: any) {
      logger.error('Failed to provision WireGuard peer', { error: err.message });
      return reply.status(500).send({
        success: false,
        error: { code: 'PROVISION_FAILED', message: err.message || 'Unable to provision VPN tunnel' },
      });
    }

    // Persist Device, VpnPeer, and IpAllocation atomically in a transaction
    const createdDevice = await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          id: newDeviceId,
          userId,
          name: input.name,
          status: 'ACTIVE',
        },
      });

      const peer = await tx.vpnPeer.create({
        data: {
          deviceId: device.id,
          publicKey: provisionResult.publicKey,
          tunnelIp: provisionResult.tunnelIp,
          serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
        },
      });

      await tx.ipAllocation.upsert({
        where: { ipAddress: provisionResult.tunnelIp },
        create: {
          ipAddress: provisionResult.tunnelIp,
          status: 'ALLOCATED',
          vpnPeerId: peer.id,
        },
        update: {
          status: 'ALLOCATED',
          vpnPeerId: peer.id,
          releasedAt: null,
        },
      });

      await tx.auditEvent.create({
        data: {
          userId,
          action: AUDIT_ACTIONS.DEVICE_CREATED,
          ipAddress: request.ip,
          details: {
            deviceId: device.id,
            deviceName: input.name,
            tunnelIp: provisionResult.tunnelIp,
          },
        },
      });

      return device;
    });

    const responseData: WireGuardClientConfig = {
      deviceId: createdDevice.id,
      deviceName: createdDevice.name,
      tunnelIp: provisionResult.tunnelIp,
      publicKey: provisionResult.publicKey,
      privateKey: provisionResult.privateKey,
      rawConfig: provisionResult.rawConfig,
      qrCodeDataUrl: provisionResult.qrCodeDataUrl,
      serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
      serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
      dnsServer: appConfig.VPN_DNS_SERVER,
      allowedIps: '0.0.0.0/0, ::/0',
    };

    return reply.status(201).send({
      success: true,
      data: responseData,
    });
  });

  // GET /api/devices/:id/config - Download or display device WireGuard config
  fastify.get('/:id/config', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const device = await prisma.device.findFirst({
      where: { id, userId, status: 'ACTIVE' },
      include: { vpnPeer: true },
    });

    if (!device || !device.vpnPeer) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Active device or tunnel not found' },
      });
    }

    const rawConfig = generateWireGuardClientConfig({
      clientPrivateKey: 'INSERT_YOUR_PRIVATE_KEY_HERE',
      clientAddress: `${device.vpnPeer.tunnelIp}/32`,
      serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
      serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
      dnsServers: appConfig.VPN_DNS_SERVER,
      allowedIps: '0.0.0.0/0, ::/0',
    });

    const qrCodeDataUrl = await generateQrCodeDataUrl(rawConfig);

    return reply.send({
      success: true,
      data: {
        deviceId: device.id,
        deviceName: device.name,
        tunnelIp: device.vpnPeer.tunnelIp,
        publicKey: device.vpnPeer.publicKey,
        rawConfig,
        qrCodeDataUrl,
        serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
        serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
        dnsServer: appConfig.VPN_DNS_SERVER,
        allowedIps: '0.0.0.0/0, ::/0',
      } as WireGuardClientConfig,
    });
  });

  // DELETE /api/devices/:id - Revoke device and reclaim tunnel IP
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const device = await prisma.device.findFirst({
      where: { id, userId, status: 'ACTIVE' },
      include: { vpnPeer: true },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found or already revoked' },
      });
    }

    if (device.vpnPeer?.publicKey) {
      try {
        await wireguardManager.revokePeer(device.vpnPeer.publicKey);
      } catch (err: any) {
        logger.warn(`Error removing peer from WireGuard: ${err.message}`);
      }
    }

    // Atomically mark device REVOKED and IP allocation RELEASED
    await prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id: device.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      if (device.vpnPeer?.tunnelIp) {
        await tx.ipAllocation.updateMany({
          where: { ipAddress: device.vpnPeer.tunnelIp },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId,
          action: AUDIT_ACTIONS.DEVICE_REVOKED,
          ipAddress: request.ip,
          details: {
            deviceId: device.id,
            name: device.name,
            tunnelIp: device.vpnPeer?.tunnelIp,
          },
        },
      });
    });

    logger.info('Device successfully revoked', { deviceId: device.id, userId });

    return reply.send({
      success: true,
      data: { message: `Device '${device.name}' successfully revoked` },
    });
  });
};
