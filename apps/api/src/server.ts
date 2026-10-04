import { buildApp } from './app.js';
import { appConfig } from '@bharattunnel/config';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { enforceVoucherExpirations } from './modules/vouchers/vouchers.routes.js';
import { syncActiveVouchersToXray } from './lib/xray.js';

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

  // Periodic expiration enforcement job: runs every 10 minutes
  const expiryInterval = setInterval(async () => {
    try {
      await enforceVoucherExpirations();
    } catch (e: any) {
      logger.warn(`Voucher expiry enforcement job failed: ${e.message}`);
    }
  }, 10 * 60 * 1000);

  // Initial check and Xray synchronization on boot
  enforceVoucherExpirations().catch((e) => logger.warn(`Initial expiry sweep failed: ${e.message}`));
  syncActiveVouchersToXray().catch((e) => logger.warn(`Initial Xray sync failed: ${e.message}`));

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(expiryInterval);
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
