import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { appConfig } from '@bharattunnel/config';
import { MONTHLY_BANDWIDTH_BYTES_DEFAULT, BandwidthUsageSummary } from '@bharattunnel/shared';

export const usageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /api/usage - Current user's bandwidth consumption & quota
  fastify.get('/', async (request, reply) => {
    const userId = request.user!.id;

    const devices = await prisma.device.findMany({
      where: { userId },
      include: { vpnPeer: true },
    });

    let totalBytesRx = 0n;
    let totalBytesTx = 0n;
    let activeDevices = 0;

    for (const d of devices) {
      if (d.status === 'ACTIVE') {
        activeDevices++;
      }
      if (d.vpnPeer) {
        totalBytesRx += d.vpnPeer.bytesRx;
        totalBytesTx += d.vpnPeer.bytesTx;
      }
    }

    const totalUsedBytes = Number(totalBytesRx + totalBytesTx);
    const monthlyLimitBytes = appConfig.MONTHLY_BANDWIDTH_GB * 1024 * 1024 * 1024;
    const percentage = Math.min(100, Math.round((totalUsedBytes / monthlyLimitBytes) * 100));

    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const summary: BandwidthUsageSummary = {
      userId,
      monthlyLimitBytes,
      usedBytes: totalUsedBytes,
      percentageUsed: percentage,
      bytesRx: Number(totalBytesRx),
      bytesTx: Number(totalBytesTx),
      billingCycleStart: cycleStart,
      billingCycleEnd: cycleEnd,
      deviceCount: activeDevices,
      maxDevices: appConfig.MAX_DEVICES_PER_USER,
    };

    return reply.send({ success: true, data: summary });
  });
};
