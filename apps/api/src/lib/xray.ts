import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { appConfig } from '@bharattunnel/config';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

const execAsync = promisify(exec);

/**
 * Generates standard VLESS Reality subscription URL compatible with Happ, v2rayNG, Sing-box, etc.
 * Format: vless://uuid@host:port?encryption=none&flow=xtls-rprx-vision&security=reality&sni=...#Name
 */
export function generateVlessUrl(voucherId: string, studentName?: string): string {
  const host = appConfig.VPN_SERVER_HOST;
  const port = appConfig.XRAY_PORT;
  const sni = appConfig.XRAY_SERVER_NAME;
  const pbk = appConfig.XRAY_REALITY_PUBLIC_KEY;
  const sid = appConfig.XRAY_REALITY_SHORT_ID;
  const label = encodeURIComponent(`BharatTunnel 🇮🇳 Mumbai (${studentName || 'Student'})`);

  return `vless://${voucherId}@${host}:${port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${sni}&fp=chrome&pbk=${pbk}&sid=${sid}&type=tcp#${label}`;
}

/**
 * Synchronizes all currently ACTIVE vouchers in the database to /etc/xray/config.json
 * and triggers a fast graceful reload of the Xray service.
 */
export async function syncActiveVouchersToXray(): Promise<void> {
  const configPath = appConfig.XRAY_CONFIG_PATH;

  if (!fs.existsSync(configPath)) {
    // If not running on the Linux VM with Xray installed, skip gracefully
    return;
  }

  try {
    const activeVouchers = await prisma.voucher.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        code: true,
        studentName: true,
      },
    });

    const rawContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(rawContent);

    if (config.inbounds && config.inbounds[0] && config.inbounds[0].settings) {
      config.inbounds[0].settings.clients = activeVouchers.map((v) => ({
        id: v.id,
        flow: 'xtls-rprx-vision',
        email: `${v.code.toLowerCase()}@bharattunnel.in`,
      }));

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      logger.info(`Synced ${activeVouchers.length} active vouchers to Xray configuration (${configPath})`);

      try {
        await execAsync('systemctl restart xray');
        logger.info('Xray service successfully restarted with updated client list');
      } catch (err: any) {
        logger.warn(`Could not restart xray service via systemctl: ${err.message}`);
      }
    }
  } catch (error: any) {
    logger.error('Failed to sync active vouchers to Xray', { error: error.message });
  }
}
