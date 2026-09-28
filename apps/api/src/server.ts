import { buildApp } from './app.js';
import { appConfig } from '@bharattunnel/config';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

async function startServer() {
  const app = await buildApp();

  try {
    await app.listen({ port: appConfig.PORT, host: '0.0.0.0' });
    logger.info(`BharatTunnel API Server active on http://0.0.0.0:${appConfig.PORT}`);
    logger.info(`WireGuard Driver: ${appConfig.WIREGUARD_DRIVER.toUpperCase()}`);
    logger.info(`Subnet: ${appConfig.VPN_NETWORK} | Gateway: ${appConfig.VPN_GATEWAY_IP}`);
  } catch (err: any) {
    logger.error('Failed to start BharatTunnel API Server', { error: err.message });
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      await prisma.$disconnect();
      logger.info('Server successfully closed.');
      process.exit(0);
    } catch (e: any) {
      logger.error('Error during shutdown', { error: e.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
