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

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use custom sanitized logger to ensure zero credential/key leakage
    trustProxy: true,
  });

  // CORS
  await app.register(cors, {
    origin: [appConfig.WEB_BASE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
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
    max: 60,
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
  await app.register(deviceRoutes, { prefix: '/api/devices' });
  await app.register(gatewayRoutes, { prefix: '/api/gateways' });
  await app.register(usageRoutes, { prefix: '/api/usage' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}
