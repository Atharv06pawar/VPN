import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { appConfig } from '@bharattunnel/config';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { deviceRoutes } from './modules/devices/devices.routes.js';
import { gatewayRoutes } from './modules/gateways/gateways.routes.js';
import { usageRoutes } from './modules/usage/usage.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { voucherRoutes } from './modules/vouchers/vouchers.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use custom sanitized logger to ensure zero credential/key leakage
    trustProxy: true,
  });

  // CORS - Permit Vercel deployments, localhost, and configured domains
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return cb(null, true);
      if (
        origin === appConfig.WEB_BASE_URL ||
        origin === 'http://localhost:3000' ||
        origin === 'http://127.0.0.1:3000' ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return cb(null, true);
      }
      return cb(null, true); // Permissive CORS for student claim portal
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cookies
  await app.register(cookie, {
    secret: appConfig.COOKIE_SECRET,
  });

  // JWT
  await app.register(jwt, {
    secret: appConfig.JWT_SECRET,
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Custom centralized error handler
  app.setErrorHandler(errorHandler);

  // Health check endpoint
  app.get('/health', async () => ({
    status: 'ok',
    service: 'bharattunnel-api',
    timestamp: new Date().toISOString(),
  }));

  // API Route registrations
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(voucherRoutes, { prefix: '/api/vouchers' });
  await app.register(deviceRoutes, { prefix: '/api/devices' });
  await app.register(gatewayRoutes, { prefix: '/api/gateways' });
  await app.register(usageRoutes, { prefix: '/api/usage' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}
