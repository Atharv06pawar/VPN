import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { wireguardManager } from '../../lib/wireguard.js';
import { AUDIT_ACTIONS, PaginationSchema } from '@bharattunnel/shared';
import { logger } from '../../lib/logger.js';

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/metrics - High-level system overview
  fastify.get('/metrics', async (_request, reply) => {
    const totalUsers = await prisma.user.count();
    const suspendedUsers = await prisma.user.count({ where: { status: 'SUSPENDED' } });
    const activeDevices = await prisma.device.count({ where: { status: 'ACTIVE' } });
    const totalPeers = await prisma.vpnPeer.count();

    const peers = await prisma.vpnPeer.findMany({
      select: { bytesRx: true, bytesTx: true },
    });

    let totalRx = 0n;
    let totalTx = 0n;
    for (const p of peers) {
      totalRx += p.bytesRx;
      totalTx += p.bytesTx;
    }

    const gatewayHealth = await wireguardManager.getGatewayHealth();

    return reply.send({
      success: true,
      data: {
        totalUsers,
        activeUsers: totalUsers - suspendedUsers,
        suspendedUsers,
        activeDevices,
        totalPeers,
        gatewayStatus: gatewayHealth.status,
        traffic: {
          totalBytesRx: Number(totalRx),
          totalBytesTx: Number(totalTx),
          totalBytesCombined: Number(totalRx + totalTx),
        },
        gateway: gatewayHealth,
      },
    });
  });

  // GET /api/admin/users - List users with active device counters and quotas
  fastify.get('/users', async (request, reply) => {
    const query = PaginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          devices: {
            include: { vpnPeer: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => {
      let userRx = 0n;
      let userTx = 0n;
      let activeDevs = 0;

      for (const d of u.devices) {
        if (d.status === 'ACTIVE') activeDevs++;
        if (d.vpnPeer) {
          userRx += d.vpnPeer.bytesRx;
          userTx += d.vpnPeer.bytesTx;
        }
      }

      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        deviceCount: activeDevs,
        totalBandwidthBytes: Number(userRx + userTx),
        createdAt: u.createdAt.toISOString(),
      };
    });

    return reply.send({
      success: true,
      data: {
        users: data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  });

  // POST /api/admin/users/:id/suspend - Administratively suspend user and revoke live VPN tunnels
  fastify.post('/users/:id/suspend', async (request, reply) => {
    const adminId = request.user!.id;
    const { id } = request.params as { id: string };

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        devices: {
          where: { status: 'ACTIVE' },
          include: { vpnPeer: true },
        },
      },
    });

    if (!targetUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Instantly remove peers from live WireGuard kernel interface
    for (const d of targetUser.devices) {
      if (d.vpnPeer?.publicKey) {
        try {
          await wireguardManager.revokePeer(d.vpnPeer.publicKey);
        } catch (e: any) {
          logger.warn(`Failed to revoke peer for suspended user: ${e.message}`);
        }
      }
    }

    // Update status and audit
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: 'SUSPENDED' },
      });

      await tx.auditEvent.create({
        data: {
          userId: id,
          adminId,
          action: AUDIT_ACTIONS.USER_SUSPENDED,
          ipAddress: request.ip,
          details: { reason: (request.body as any)?.reason || 'Administrative action' },
        },
      });
    });

    logger.info('User suspended by admin', { targetUserId: id, adminId });

    return reply.send({ success: true, data: { message: `User ${targetUser.email} has been suspended.` } });
  });

  // POST /api/admin/users/:id/unsuspend - Unsuspend user
  fastify.post('/users/:id/unsuspend', async (request, reply) => {
    const adminId = request.user!.id;
    const { id } = request.params as { id: string };

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        devices: {
          where: { status: 'ACTIVE' },
          include: { vpnPeer: true },
        },
      },
    });

    if (!targetUser) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Re-provision existing active device peers on WireGuard interface
    for (const d of targetUser.devices) {
      if (d.vpnPeer?.publicKey && d.vpnPeer.tunnelIp) {
        try {
          await (wireguardManager as any).driver.addPeer(d.vpnPeer.publicKey, d.vpnPeer.tunnelIp);
        } catch (e: any) {
          logger.warn(`Failed to restore WireGuard peer during unsuspend: ${e.message}`);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      await tx.auditEvent.create({
        data: {
          userId: id,
          adminId,
          action: AUDIT_ACTIONS.USER_UNSUSPENDED,
          ipAddress: request.ip,
        },
      });
    });

    logger.info('User unsuspended by admin', { targetUserId: id, adminId });

    return reply.send({ success: true, data: { message: `User ${targetUser.email} has been restored to active status.` } });
  });

  // POST /api/admin/devices/:id/revoke - Force revoke device
  fastify.post('/devices/:id/revoke', async (request, reply) => {
    const adminId = request.user!.id;
    const { id } = request.params as { id: string };

    const device = await prisma.device.findUnique({
      where: { id },
      include: { vpnPeer: true, user: true },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    if (device.vpnPeer?.publicKey) {
      try {
        await wireguardManager.revokePeer(device.vpnPeer.publicKey);
      } catch (err: any) {
        logger.warn(`Error removing peer during admin revocation: ${err.message}`);
      }
    }

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
          userId: device.userId,
          adminId,
          action: AUDIT_ACTIONS.DEVICE_REVOKED,
          ipAddress: request.ip,
          details: {
            reason: 'Administrative revocation',
            deviceId: device.id,
            deviceName: device.name,
          },
        },
      });
    });

    return reply.send({ success: true, data: { message: `Device ${device.name} revoked by administrator.` } });
  });

  // GET /api/admin/audit-logs - View audit trail
  fastify.get('/audit-logs', async (request, reply) => {
    const query = PaginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, fullName: true } },
        },
      }),
      prisma.auditEvent.count(),
    ]);

    const formatted = logs.map((l) => ({
      id: l.id,
      action: l.action,
      userId: l.userId,
      userEmail: l.user?.email || null,
      adminId: l.adminId,
      ipAddress: l.ipAddress,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
    }));

    return reply.send({
      success: true,
      data: {
        logs: formatted,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  });
};
