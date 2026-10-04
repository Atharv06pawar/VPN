import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { wireguardManager } from '../../lib/wireguard.js';
import { logger } from '../../lib/logger.js';
import { appConfig } from '@bharattunnel/config';
import { authenticate } from '../../middleware/authenticate.js';
import {
  generateWireGuardKeyPair,
  generateWireGuardClientConfig,
  generateQrCodeDataUrl,
} from '@bharattunnel/wireguard';
import {
  CreateVoucherSchema,
  RenewVoucherSchema,
  PaginationSchema,
  VoucherInfo,
  ClaimVoucherResponse,
} from '@bharattunnel/shared';
import { generateVlessUrl, syncActiveVouchersToXray } from '../../lib/xray.js';

/**
 * Generates a human-readable, high-entropy 12-char alphanumeric voucher code.
 * Example: BT-4K8P-9M2X-7R4W
 */
function generateVoucherCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const segment = (len: number) => {
    const bytes = crypto.randomBytes(len);
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars[bytes[i] % chars.length];
    }
    return s;
  };
  return `BT-${segment(4)}-${segment(4)}-${segment(4)}`;
}

export const voucherRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ============================================================================
  // PUBLIC CLAIM ENDPOINT (Zero-login for students)
  // GET /api/vouchers/claim/:code
  // ============================================================================
  fastify.get('/claim/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const normalizedCode = code.trim().toUpperCase();

    const voucher = await prisma.voucher.findUnique({
      where: { code: normalizedCode },
    });

    if (!voucher) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'VOUCHER_NOT_FOUND',
          message: 'Invalid access code. Please check your code or contact your administrator.',
        },
      });
    }

    if (voucher.status === 'REVOKED') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'VOUCHER_REVOKED',
          message: 'This access code has been revoked by the administrator.',
        },
      });
    }

    const now = new Date();
    const isExpired = voucher.expiresAt < now;

    if (isExpired) {
      if (voucher.status === 'ACTIVE') {
        // Automatically drop peer and mark as expired
        try {
          await wireguardManager.revokePeer(voucher.publicKey);
        } catch (e: any) {
          logger.warn(`Failed to drop expired peer ${voucher.publicKey}: ${e.message}`);
        }
        await prisma.voucher.update({
          where: { id: voucher.id },
          data: { status: 'EXPIRED' },
        });
      }

      return reply.status(410).send({
        success: false,
        error: {
          code: 'VOUCHER_EXPIRED',
          message: `This voucher expired on ${voucher.expiresAt.toLocaleDateString()}. Please contact your administrator to renew for 30 more days.`,
        },
      });
    }

    const daysRemaining = Math.max(0, Math.ceil((voucher.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Generate Profile A: AmneziaWG (Russia / Strict DPI Bypass)
    const amneziaConfig = generateWireGuardClientConfig({
      clientPrivateKey: voucher.privateKey,
      clientAddress: `${voucher.tunnelIp}/32`,
      serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
      serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
      dnsServers: appConfig.VPN_DNS_SERVER,
      allowedIps: '0.0.0.0/0, ::/0',
      enableAmneziaWg: true,
      amneziaParams: {
        jc: appConfig.AMNEZIA_JC,
        jmin: appConfig.AMNEZIA_JMIN,
        jmax: appConfig.AMNEZIA_JMAX,
        s1: appConfig.AMNEZIA_S1,
        s2: appConfig.AMNEZIA_S2,
        h1: appConfig.AMNEZIA_H1,
        h2: appConfig.AMNEZIA_H2,
        h3: appConfig.AMNEZIA_H3,
        h4: appConfig.AMNEZIA_H4,
      },
    });

    // Generate Profile B: Standard WireGuard (Worldwide / Global)
    const standardConfig = generateWireGuardClientConfig({
      clientPrivateKey: voucher.privateKey,
      clientAddress: `${voucher.tunnelIp}/32`,
      serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
      serverEndpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
      dnsServers: appConfig.VPN_DNS_SERVER,
      allowedIps: '0.0.0.0/0, ::/0',
      enableAmneziaWg: false,
    });

    // Generate Profile C: Happ / Xray (VLESS-Reality TLS 1.3 - Recommended for iOS & Anti-DPI)
    const happUrl = generateVlessUrl(voucher.id, voucher.studentName);

    const [amneziaQrCode, standardQrCode, happQrCode] = await Promise.all([
      generateQrCodeDataUrl(amneziaConfig),
      generateQrCodeDataUrl(standardConfig),
      generateQrCodeDataUrl(happUrl),
    ]);

    const responseData: ClaimVoucherResponse = {
      code: voucher.code,
      studentName: voucher.studentName,
      status: voucher.status,
      daysRemaining,
      expiresAt: voucher.expiresAt.toISOString(),
      tunnelIp: voucher.tunnelIp,
      serverEndpoint: voucher.serverEndpoint,
      happUrl,
      happQrCode,
      amneziaConfig,
      standardConfig,
      amneziaQrCode,
      standardQrCode,
    };

    return reply.send({
      success: true,
      data: responseData,
    });
  });

  // ============================================================================
  // ADMIN ONLY ENDPOINTS (Voucher Management)
  // ============================================================================

  // GET /api/vouchers - List all vouchers with live stats
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const { page, limit, search } = PaginationSchema.parse(request.query);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { studentName: { contains: search, mode: 'insensitive' } },
        { telegramHandle: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, vouchers] = await Promise.all([
      prisma.voucher.count({ where }),
      prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Try to get live peer stats from WireGuard driver
    let livePeers: Record<string, { latestHandshake?: Date; bytesRx?: bigint; bytesTx?: bigint }> = {};
    try {
      const peersInfo = await wireguardManager.listPeers();
      for (const p of peersInfo) {
        livePeers[p.publicKey] = {
          latestHandshake: p.latestHandshake ? new Date(p.latestHandshake) : undefined,
          bytesRx: p.transferRx ? BigInt(p.transferRx) : undefined,
          bytesTx: p.transferTx ? BigInt(p.transferTx) : undefined,
        };
      }
    } catch {
      // Non-fatal if driver is mock or offline
    }

    const now = new Date();
    const formattedVouchers: VoucherInfo[] = vouchers.map((v) => {
      const live = livePeers[v.publicKey];
      const isExpired = v.expiresAt < now || v.status === 'EXPIRED';
      const daysRemaining = isExpired
        ? 0
        : Math.max(0, Math.ceil((v.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: v.id,
        code: v.code,
        studentName: v.studentName,
        telegramHandle: v.telegramHandle,
        telegramChatId: v.telegramChatId,
        notes: v.notes,
        validityDays: v.validityDays,
        status: isExpired && v.status === 'ACTIVE' ? 'EXPIRED' : v.status,
        createdAt: v.createdAt.toISOString(),
        expiresAt: v.expiresAt.toISOString(),
        daysRemaining,
        isExpired,
        tunnelIp: v.tunnelIp,
        publicKey: v.publicKey,
        latestHandshakeAt: live?.latestHandshake ? live.latestHandshake.toISOString() : v.latestHandshakeAt?.toISOString() || null,
        bytesRx: Number(live?.bytesRx ?? v.bytesRx),
        bytesTx: Number(live?.bytesTx ?? v.bytesTx),
      };
    });

    return reply.send({
      success: true,
      data: {
        vouchers: formattedVouchers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  // POST /api/vouchers - Generate a new 30-day voucher
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const input = CreateVoucherSchema.parse(request.body);

    // 1. Gather all allocated IPs to prevent collisions
    const [allocatedInDb, existingVouchers] = await Promise.all([
      prisma.ipAllocation.findMany({ where: { status: 'ALLOCATED' }, select: { ipAddress: true } }),
      prisma.voucher.findMany({ where: { status: 'ACTIVE' }, select: { tunnelIp: true } }),
    ]);

    const allocatedSet = new Set<string>([
      ...allocatedInDb.map((a) => a.ipAddress),
      ...existingVouchers.map((v) => v.tunnelIp),
      appConfig.VPN_GATEWAY_IP,
    ]);

    const tunnelIp = wireguardManager.getAllocator().allocateNextIp(Array.from(allocatedSet));

    // 2. Generate unique voucher code
    let code = generateVoucherCode();
    let collisionCheck = await prisma.voucher.findUnique({ where: { code } });
    while (collisionCheck) {
      code = generateVoucherCode();
      collisionCheck = await prisma.voucher.findUnique({ where: { code } });
    }

    // 3. Generate WireGuard cryptographic keypair
    const keyPair = generateWireGuardKeyPair();
    const validityDays = input.validityDays || 30;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    const serverEndpoint = `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`;

    // 4. Register peer in WireGuard interface
    try {
      await wireguardManager.addPeer(keyPair.publicKey, tunnelIp);
    } catch (err: any) {
      logger.error('Failed to register peer in WireGuard driver', { error: err.message });
      return reply.status(500).send({
        success: false,
        error: { code: 'PEER_REGISTRATION_FAILED', message: err.message || 'Failed to add peer to VPN interface' },
      });
    }

    // 5. Store in Supabase and reserve IP
    const [voucher] = await prisma.$transaction([
      prisma.voucher.create({
        data: {
          code,
          studentName: input.studentName,
          telegramHandle: input.telegramHandle || null,
          telegramChatId: input.telegramChatId || null,
          notes: input.notes || null,
          validityDays,
          status: 'ACTIVE',
          expiresAt,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          tunnelIp,
          serverEndpoint,
        },
      }),
      prisma.ipAllocation.upsert({
        where: { ipAddress: tunnelIp },
        create: { ipAddress: tunnelIp, status: 'ALLOCATED' },
        update: { status: 'ALLOCATED' },
      }),
    ]);

    logger.info('Created new 30-day VPN voucher', {
      voucherId: voucher.id,
      code: voucher.code,
      studentName: voucher.studentName,
      tunnelIp,
    });

    // Synchronize client list with Xray Reality for Happ
    syncActiveVouchersToXray().catch((e) => logger.warn(`Failed to sync Xray: ${e.message}`));

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((voucher.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const voucherInfo: VoucherInfo = {
      id: voucher.id,
      code: voucher.code,
      studentName: voucher.studentName,
      telegramHandle: voucher.telegramHandle,
      telegramChatId: voucher.telegramChatId,
      notes: voucher.notes,
      validityDays: voucher.validityDays,
      status: voucher.status,
      createdAt: voucher.createdAt.toISOString(),
      expiresAt: voucher.expiresAt.toISOString(),
      daysRemaining,
      isExpired: false,
      tunnelIp: voucher.tunnelIp,
      publicKey: voucher.publicKey,
      bytesRx: 0,
      bytesTx: 0,
    };

    return reply.status(201).send({
      success: true,
      data: {
        voucher: voucherInfo,
        claimUrl: `/claim?code=${voucher.code}`,
      },
    });
  });

  // POST /api/vouchers/:id/renew - Extend voucher by 30 days (+30 Days)
  fastify.post('/:id/renew', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const { id } = request.params as { id: string };
    const { additionalDays } = RenewVoucherSchema.parse(request.body || {});

    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Voucher not found' } });
    }

    const now = new Date();
    let newExpiresAt: Date;

    if (voucher.expiresAt > now && voucher.status === 'ACTIVE') {
      newExpiresAt = new Date(voucher.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    } else {
      newExpiresAt = new Date(now.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    }

    // Re-add to WireGuard driver in case it was previously dropped
    try {
      await wireguardManager.addPeer(voucher.publicKey, voucher.tunnelIp);
    } catch (e: any) {
      logger.warn(`Failed to reinstall peer ${voucher.publicKey}: ${e.message}`);
    }

    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        expiresAt: newExpiresAt,
        validityDays: voucher.validityDays + additionalDays,
      },
    });

    const daysRemaining = Math.max(0, Math.ceil((updated.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    logger.info('Voucher successfully renewed', {
      voucherId: updated.id,
      code: updated.code,
      newExpiresAt: updated.expiresAt.toISOString(),
      daysRemaining,
    });

    syncActiveVouchersToXray().catch((e) => logger.warn(`Failed to sync Xray: ${e.message}`));

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        code: updated.code,
        status: updated.status,
        expiresAt: updated.expiresAt.toISOString(),
        daysRemaining,
      },
    });
  });

  // POST /api/vouchers/:id/revoke - Revoke / freeze voucher
  fastify.post('/:id/revoke', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const { id } = request.params as { id: string };
    const voucher = await prisma.voucher.findUnique({ where: { id } });

    if (!voucher) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Voucher not found' } });
    }

    try {
      await wireguardManager.revokePeer(voucher.publicKey);
    } catch (e: any) {
      logger.warn(`Failed to remove peer ${voucher.publicKey}: ${e.message}`);
    }

    const updated = await prisma.voucher.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    syncActiveVouchersToXray().catch((e) => logger.warn(`Failed to sync Xray: ${e.message}`));

    return reply.send({
      success: true,
      data: { id: updated.id, status: updated.status },
    });
  });

  // DELETE /api/vouchers/:id - Delete voucher and release IP
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const { id } = request.params as { id: string };
    const voucher = await prisma.voucher.findUnique({ where: { id } });

    if (!voucher) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Voucher not found' } });
    }

    try {
      await wireguardManager.revokePeer(voucher.publicKey);
    } catch (e: any) {
      logger.warn(`Failed to remove peer ${voucher.publicKey}: ${e.message}`);
    }

    await prisma.$transaction([
      prisma.voucher.delete({ where: { id } }),
      prisma.ipAllocation.updateMany({
        where: { ipAddress: voucher.tunnelIp },
        data: { status: 'RELEASED' },
      }),
    ]);

    syncActiveVouchersToXray().catch((e) => logger.warn(`Failed to sync Xray: ${e.message}`));

    return reply.send({
      success: true,
      data: { message: `Voucher ${voucher.code} and IP ${voucher.tunnelIp} deleted successfully` },
    });
  });
};

/**
 * Periodically called to drop expired peers from WireGuard interface
 */
export async function enforceVoucherExpirations(): Promise<void> {
  try {
    const expiredActiveVouchers = await prisma.voucher.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
      },
    });

    for (const v of expiredActiveVouchers) {
      try {
        await wireguardManager.revokePeer(v.publicKey);
        logger.info(`Auto-dropped expired peer ${v.publicKey} (${v.code}) from interface`);
      } catch (e: any) {
        logger.warn(`Error removing expired peer ${v.publicKey}: ${e.message}`);
      }

      await prisma.voucher.update({
        where: { id: v.id },
        data: { status: 'EXPIRED' },
      });
    }

    if (expiredActiveVouchers.length > 0) {
      await syncActiveVouchersToXray();
    }
  } catch (err: any) {
    logger.error('Error enforcing voucher expirations', { error: err.message });
  }
}
