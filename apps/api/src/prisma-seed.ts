import { prisma } from './lib/prisma.js';
import { hashPassword } from './lib/auth.js';
import { appConfig } from '@bharattunnel/config';
import { logger } from './lib/logger.js';

async function seed() {
  logger.info('Starting BharatTunnel database seed...');

  // 1. Seed or update initial admin account
  const existingAdmin = await prisma.user.findUnique({
    where: { email: appConfig.ADMIN_EMAIL },
  });

  if (!existingAdmin) {
    const passwordHash = await hashPassword(appConfig.ADMIN_INITIAL_PASSWORD);
    const admin = await prisma.user.create({
      data: {
        email: appConfig.ADMIN_EMAIL,
        fullName: 'BharatTunnel System Administrator',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    logger.info(`Default Admin account created: ${admin.email}`);
  } else {
    logger.info(`Admin account already exists: ${existingAdmin.email}`);
  }

  // 2. Seed initial VpnGateway
  const gatewayCount = await prisma.vpnGateway.count();
  if (gatewayCount === 0) {
    const gw = await prisma.vpnGateway.create({
      data: {
        name: 'BharatTunnel India Gateway (Mumbai-1)',
        endpoint: `${appConfig.VPN_SERVER_HOST}:${appConfig.VPN_SERVER_PORT}`,
        publicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
        listenPort: appConfig.VPN_SERVER_PORT,
        networkCidr: appConfig.VPN_NETWORK,
        gatewayIp: appConfig.VPN_GATEWAY_IP,
        status: 'HEALTHY',
      },
    });
    logger.info(`Default Gateway provisioned: ${gw.name}`);
  }

  // 3. Ensure gateway IP is reserved in IpAllocation
  await prisma.ipAllocation.upsert({
    where: { ipAddress: appConfig.VPN_GATEWAY_IP },
    create: {
      ipAddress: appConfig.VPN_GATEWAY_IP,
      status: 'ALLOCATED',
    },
    update: {},
  });

  logger.info('Database seeding completed successfully.');
}

seed()
  .catch((e) => {
    logger.error('Seed script encountered error', { error: e.message });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
