import { describe, it, expect } from 'vitest';
import {
  generateWireGuardClientConfig,
  generateQrCodeDataUrl,
  generateWireGuardKeyPair,
} from '@bharattunnel/wireguard';

describe('WireGuard Config & QR Generation', () => {
  const clientKeys = generateWireGuardKeyPair();
  const serverKeys = generateWireGuardKeyPair();

  it('generates a standard compliant WireGuard client configuration file', () => {
    const config = generateWireGuardClientConfig({
      clientPrivateKey: clientKeys.privateKey,
      clientAddress: '10.50.0.2/32',
      serverPublicKey: serverKeys.publicKey,
      serverEndpoint: '203.0.113.1:51820',
      dnsServers: '10.50.0.1, 1.1.1.1',
      allowedIps: '0.0.0.0/0, ::/0',
      persistentKeepalive: 25,
    });

    expect(config).toContain('[Interface]');
    expect(config).toContain(`PrivateKey = ${clientKeys.privateKey}`);
    expect(config).toContain('Address = 10.50.0.2/32');
    expect(config).toContain('DNS = 10.50.0.1, 1.1.1.1');
    expect(config).toContain('[Peer]');
    expect(config).toContain(`PublicKey = ${serverKeys.publicKey}`);
    expect(config).toContain('Endpoint = 203.0.113.1:51820');
    expect(config).toContain('AllowedIPs = 0.0.0.0/0, ::/0');
    expect(config).toContain('PersistentKeepalive = 25');
  });

  it('rejects invalid client private key', () => {
    expect(() => {
      generateWireGuardClientConfig({
        clientPrivateKey: 'invalid-key',
        clientAddress: '10.50.0.2/32',
        serverPublicKey: serverKeys.publicKey,
        serverEndpoint: '203.0.113.1:51820',
      });
    }).toThrow(/Invalid client private key/);
  });

  it('rejects invalid client address missing CIDR mask', () => {
    expect(() => {
      generateWireGuardClientConfig({
        clientPrivateKey: clientKeys.privateKey,
        clientAddress: '10.50.0.2',
        serverPublicKey: serverKeys.publicKey,
        serverEndpoint: '203.0.113.1:51820',
      });
    }).toThrow(/Invalid client address format/);
  });

  it('generates a valid PNG QR code Data URL for mobile import', async () => {
    const config = generateWireGuardClientConfig({
      clientPrivateKey: clientKeys.privateKey,
      clientAddress: '10.50.0.2/32',
      serverPublicKey: serverKeys.publicKey,
      serverEndpoint: '203.0.113.1:51820',
    });

    const qrDataUrl = await generateQrCodeDataUrl(config);

    expect(qrDataUrl).toBeDefined();
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(qrDataUrl.length).toBeGreaterThan(100);
  });
});
