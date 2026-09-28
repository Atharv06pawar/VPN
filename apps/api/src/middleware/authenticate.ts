import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { UserRole } from '@bharattunnel/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string; role: UserRole };
    user: AuthenticatedUser;
  }
}

/**
 * Middleware: Verifies JWT token and checks active account status.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
      });
      return;
    }

    const decoded = await request.jwtVerify<{ userId: string; role: UserRole }>();

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    if (!user) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account no longer exists' },
      });
      return;
    }

    if (user.status === 'SUSPENDED') {
      reply.status(403).send({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'This account has been administratively suspended' },
      });
      return;
    }

    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
    };
  } catch (err: any) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' },
    });
  }
}

/**
 * Middleware: Enforces that the authenticated user possesses the ADMIN role.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user || request.user.role !== 'ADMIN') {
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrative privileges required' },
    });
  }
}
