import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '../../lib/auth.js';
import {
  Admin2faLoginSchema,
  Setup2faVerifySchema,
  AUDIT_ACTIONS,
  UserSummary,
} from '@bharattunnel/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { wireguardManager } from '../../lib/wireguard.js';
import { logger } from '../../lib/logger.js';
import { generateTotpSecret, getTotpUri, verifyTotp } from '../../lib/totp.js';
import { generateQrCodeDataUrl } from '@bharattunnel/wireguard';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ============================================================================
  // POST /api/auth/register - PERMANENTLY DISABLED FOR PUBLIC
  // ============================================================================
  fastify.post('/register', async (_request, reply) => {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'REGISTRATION_DISABLED',
        message: 'Public registration is disabled. BharatTunnel is an exclusive admin-managed service. Students access tunnels via 30-day voucher codes.',
      },
    });
  });

  // ============================================================================
  // POST /api/auth/login - ADMIN ONLY with 2FA TOTP Support
  // ============================================================================
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const input = Admin2faLoginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid administrative email or password' },
      });
    }

    if (user.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_ONLY',
          message: 'Access restricted to system administrators. Students should enter their voucher code at the claim portal.',
        },
      });
    }

    if (user.status === 'SUSPENDED') {
      return reply.status(403).send({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Account is administratively suspended' },
      });
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid administrative email or password' },
      });
    }

    // Step 2: Check Two-Factor Authentication (TOTP)
    if (user.twoFactorEnabled) {
      if (!input.totpCode) {
        // Signal the frontend to display the 6-digit TOTP input modal
        return reply.send({
          success: true,
          data: {
            twoFactorRequired: true,
            email: user.email,
          },
        });
      }

      const isTotpValid = verifyTotp(input.totpCode, user.twoFactorSecret || '');
      if (!isTotpValid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_2FA_CODE', message: 'Invalid 6-digit authenticator code. Check your device time and try again.' },
        });
      }
    }

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        ipAddress: request.ip,
      },
    });

    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: '12h' } // 12 hours for admin session
    );

    const rawRefreshToken = generateSessionToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
        expiresAt,
      },
    });

    const voucherCount = await prisma.voucher.count();

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          deviceCount: voucherCount,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
          expiresIn: 43200,
        },
      },
    });
  });

  // ============================================================================
  // 2FA MANAGEMENT (Admin Setup & Verification)
  // ============================================================================

  // POST /api/auth/2fa/setup - Generate TOTP Secret and QR code for Authenticator App
  fastify.post('/2fa/setup', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    const secret = generateTotpSecret();
    const otpauthUri = getTotpUri(user.email, secret, 'BharatTunnel Admin');
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);

    // Save pending secret to user record
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return reply.send({
      success: true,
      data: {
        secret,
        otpauthUri,
        qrCodeDataUrl,
      },
    });
  });

  // POST /api/auth/2fa/verify - Verify TOTP code and finalize enabling 2FA
  fastify.post('/2fa/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const { totpCode } = Setup2faVerifySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      return reply.status(400).send({
        success: false,
        error: { code: 'SETUP_NOT_INITIATED', message: 'Please initiate 2FA setup first' },
      });
    }

    const isValid = verifyTotp(totpCode, user.twoFactorSecret);
    if (!isValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_2FA_CODE', message: 'Verification code incorrect. Please try the current code from your Authenticator app.' },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    logger.info('Admin successfully activated 2FA TOTP', { userId: user.id });

    return reply.send({
      success: true,
      data: { message: 'Two-Factor Authentication (2FA) is now active on your admin account.' },
    });
  });

  // GET /api/auth/2fa/status
  fastify.get('/2fa/status', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
    return reply.send({ success: true, data: { twoFactorEnabled: Boolean(user?.twoFactorEnabled) } });
  });

  // ============================================================================
  // POST /api/auth/logout
  // ============================================================================
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    await prisma.session.deleteMany({
      where: { userId },
    });

    await prisma.auditEvent.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        ipAddress: request.ip,
      },
    });

    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
  });

  // ============================================================================
  // GET /api/auth/me
  // ============================================================================
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const voucherCount = await prisma.voucher.count();

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
        deviceCount: voucherCount,
      },
    });
  });
};
