import { describe, it, expect, beforeEach } from 'vitest';
import {
  WireGuardManager,
  MockWireGuardDriver,
  IpAllocator,
  generateWireGuardKeyPair,
} from '@bharattunnel/wireguard';

describe('WireGuardManager', () => {
  let manager: WireGuardManager;
  let driver: MockWireGuardDriver;
  let allocator: IpAllocator;

  const serverKeys = generateWireGuardKeyPair();

  beforeEach(() => {
    driver = new MockWireGuardDriver('wg0', serverKeys.publicKey, 51820);
    allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    manager = new WireGuardManager({
      driver,
      allocator,
      serverHost: '203.0.113.1',
      serverPort: 51820,
      serverPublicKey: serverKeys.publicKey,
      dnsServer: '10.50.0.1, 1.1.1.1',
    });
  });

  it('provisions a new peer with auto-generated Curve25519 keys', async () => {
    const result = await manager.provisionPeer({
      deviceId: 'dev-1',
      deviceName: 'Student Laptop',
      existingAllocatedIps: [],
    });

    expect(result.tunnelIp).toBe('10.50.0.2');
    expect(result.publicKey).toHaveLength(44);
    expect(result.privateKey).toHaveLength(44);
    expect(result.rawConfig).toContain('Address = 10.50.0.2/32');
    expect(result.rawConfig).toContain(`PrivateKey = ${result.privateKey}`);
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    // Verify registered in driver
    const peer = await manager.getPeer(result.publicKey);
    expect(peer).toBeDefined();
    expect(peer?.allowedIps).toBe('10.50.0.2/32');
  });

  it('provisions a peer when client supplies their own public key', async () => {
    const clientKeys = generateWireGuardKeyPair();

    const result = await manager.provisionPeer({
      deviceId: 'dev-2',
      deviceName: 'Custom Key Device',
      clientPublicKey: clientKeys.publicKey,
      existingAllocatedIps: ['10.50.0.2'],
    });

    expect(result.tunnelIp).toBe('10.50.0.3');
    expect(result.publicKey).toBe(clientKeys.publicKey);
    // Private key must not be populated
    expect(result.privateKey).toBeUndefined();
    expect(result.rawConfig).toContain('INSERT_YOUR_PRIVATE_KEY_HERE');
  });

  it('revokes a peer from the driver', async () => {
    const result = await manager.provisionPeer({
      deviceId: 'dev-3',
      deviceName: 'Device to Revoke',
      existingAllocatedIps: [],
    });

    expect(await manager.getPeer(result.publicKey)).toBeDefined();

    await manager.revokePeer(result.publicKey);
    expect(await manager.getPeer(result.publicKey)).toBeNull();
  });

  it('returns comprehensive gateway health and traffic stats', async () => {
    const health = await manager.getGatewayHealth();

    expect(health.status).toBe('HEALTHY');
    expect(health.endpoint).toBe('203.0.113.1:51820');
    expect(health.wireguardInterface).toBe('wg0');
    expect(health.system.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(health.system.memoryTotalMb).toBeGreaterThan(0);
  });
});
