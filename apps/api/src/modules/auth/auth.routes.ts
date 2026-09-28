import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '../../lib/auth.js';
import { RegisterSchema, LoginSchema, AUDIT_ACTIONS, UserSummary } from '@bharattunnel/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { wireguardManager } from '../../lib/wireguard.js';
import { logger } from '../../lib/logger.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/auth/register
  fastify.post('/register', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const input = RegisterSchema.parse(request.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email address already exists' },
      });
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: AUDIT_ACTIONS.USER_REGISTERED,
        ipAddress: request.ip,
      },
    });

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' }
    );

    const rawRefreshToken = generateSessionToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
        expiresAt,
      },
    });

    logger.info('User successfully registered', { userId: user.id, email: user.email });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
        } as UserSummary,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
          expiresIn: 900,
        },
      },
    });
  });

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const input = LoginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password' },
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
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password' },
      });
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
      { expiresIn: '15m' }
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

    const deviceCount = await prisma.device.count({
      where: { userId: user.id, status: 'ACTIVE' },
    });

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
          deviceCount,
        } as UserSummary,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
          expiresIn: 900,
        },
      },
    });
  });

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    // Prune user sessions
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

  // GET /api/auth/me
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
        createdAt: true,
        devices: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        deviceCount: user.devices.length,
      } as UserSummary,
    });
  });

  // DELETE /api/auth/me (Account Deletion)
  fastify.delete('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    // Retrieve active devices and peers to remove from WireGuard interface
    const userDevices = await prisma.device.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { vpnPeer: true },
    });

    for (const d of userDevices) {
      if (d.vpnPeer?.publicKey) {
        try {
          await wireguardManager.revokePeer(d.vpnPeer.publicKey);
        } catch (e: any) {
          logger.warn(`Failed to clean up WireGuard peer during account deletion: ${e.message}`);
        }
      }
    }

    await prisma.auditEvent.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.USER_ACCOUNT_DELETED,
        ipAddress: request.ip,
      },
    });

    // Cascading delete deletes devices, peers, allocations, sessions
    await prisma.user.delete({
      where: { id: userId },
    });

    return reply.send({
      success: true,
      data: { message: 'Account and associated VPN tunnels deleted permanently' },
    });
  });
};
