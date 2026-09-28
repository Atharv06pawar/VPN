import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

declare global {
  // Prevent multiple PrismaClient instances during hot-reloading
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Log database connection warnings
(prisma as any).$on?.('error', (e: any) => {
  logger.error('Prisma Database Error', e);
});
