import * as QRCode from 'qrcode';
import { WireGuardConfigOptions } from './types.js';
import { isValidWireGuardKey } from './keygen.js';
import { DEFAULT_KEEPALIVE_SECONDS, DEFAULT_VPN_ALLOWED_IPS, DEFAULT_VPN_DNS } from '@bharattunnel/shared';

/**
 * Generates a standard WireGuard client configuration (.conf file contents).
 */
export function generateWireGuardClientConfig(options: WireGuardConfigOptions): string {
  const isPlaceholder = options.clientPrivateKey === 'INSERT_YOUR_PRIVATE_KEY_HERE';
  if (!isPlaceholder && !isValidWireGuardKey(options.clientPrivateKey)) {
    throw new Error('Invalid client private key: must be a 44-character base64 Curve25519 key.');
  }

  if (!isValidWireGuardKey(options.serverPublicKey)) {
    throw new Error('Invalid server public key: must be a 44-character base64 Curve25519 key.');
  }

  if (!options.clientAddress || !options.clientAddress.includes('/')) {
    throw new Error('Invalid client address format: expected CIDR e.g. 10.50.0.2/32');
  }

  if (!options.serverEndpoint || !options.serverEndpoint.includes(':')) {
    throw new Error('Invalid server endpoint format: expected host:port e.g. 203.0.113.1:51820');
  }

  const dns = options.dnsServers || DEFAULT_VPN_DNS;
  const allowedIps = options.allowedIps || DEFAULT_VPN_ALLOWED_IPS;
  const keepalive = options.persistentKeepalive ?? DEFAULT_KEEPALIVE_SECONDS;

  return [
    '# BharatTunnel India-Exit WireGuard Client Configuration',
    '# Generated automatically by BharatTunnel Control Plane',
    '# DO NOT SHARE THIS FILE - CONTAINS PRIVATE CRYPTOGRAPHIC KEY',
    '',
    '[Interface]',
    `PrivateKey = ${options.clientPrivateKey}`,
    `Address = ${options.clientAddress}`,
    `DNS = ${dns}`,
    '',
    '[Peer]',
    `PublicKey = ${options.serverPublicKey}`,
    `Endpoint = ${options.serverEndpoint}`,
    `AllowedIPs = ${allowedIps}`,
    `PersistentKeepalive = ${keepalive}`,
    '',
  ].join('\n');
}

/**
 * Generates a PNG Data URL representing the QR code of the WireGuard client configuration.
 * Official WireGuard mobile apps (Android / iOS) can scan this to import the tunnel instantly.
 */
export async function generateQrCodeDataUrl(configText: string): Promise<string> {
  return QRCode.toDataURL(configText, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
