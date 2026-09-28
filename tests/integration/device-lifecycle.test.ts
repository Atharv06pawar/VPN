import { describe, it, expect, beforeEach } from 'vitest';
import {
  WireGuardManager,
  MockWireGuardDriver,
  IpAllocator,
  generateWireGuardKeyPair,
} from '@bharattunnel/wireguard';

describe('Integration: End-to-End Device & WireGuard Peer Lifecycle', () => {
  let manager: WireGuardManager;
  let driver: MockWireGuardDriver;
  let allocator: IpAllocator;

  const serverKeys = generateWireGuardKeyPair();
  const maxDevices = 2;

  // Track active allocations in our mock integration state
  let allocatedIps: string[] = [];
  let userDevices: Array<{ deviceId: string; name: string; publicKey: string; tunnelIp: string }> = [];

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

    allocatedIps = [];
    userDevices = [];
  });

  it('executes full peer provisioning, quota enforcement, and IP reclamation', async () => {
    // Step 1: User adds Device 1 (Laptop)
    expect(userDevices.length).toBeLessThan(maxDevices);

    const dev1 = await manager.provisionPeer({
      deviceId: 'laptop-uuid-1',
      deviceName: 'Russian Dorm Laptop',
      existingAllocatedIps: allocatedIps,
    });

    allocatedIps.push(dev1.tunnelIp);
    userDevices.push({
      deviceId: 'laptop-uuid-1',
      name: 'Russian Dorm Laptop',
      publicKey: dev1.publicKey,
      tunnelIp: dev1.tunnelIp,
    });

    expect(dev1.tunnelIp).toBe('10.50.0.2');
    expect(dev1.rawConfig).toContain('Address = 10.50.0.2/32');
    expect(await manager.getPeer(dev1.publicKey)).toBeDefined();

    // Step 2: User adds Device 2 (Phone)
    expect(userDevices.length).toBeLessThan(maxDevices);

    const dev2 = await manager.provisionPeer({
      deviceId: 'phone-uuid-2',
      deviceName: 'Android Phone',
      existingAllocatedIps: allocatedIps,
    });

    allocatedIps.push(dev2.tunnelIp);
    userDevices.push({
      deviceId: 'phone-uuid-2',
      name: 'Android Phone',
      publicKey: dev2.publicKey,
      tunnelIp: dev2.tunnelIp,
    });

    expect(dev2.tunnelIp).toBe('10.50.0.3');
    expect(dev2.rawConfig).toContain('Address = 10.50.0.3/32');
    expect(await manager.getPeer(dev2.publicKey)).toBeDefined();

    // Step 3: User attempts to add Device 3 (Tablet) -> Quota Exceeded
    expect(userDevices.length >= maxDevices).toBe(true);

    // Step 4: User revokes Device 1 (Laptop)
    const deviceToRevoke = userDevices[0];
    await manager.revokePeer(deviceToRevoke.publicKey);

    // Verify peer removed from WireGuard interface
    expect(await manager.getPeer(deviceToRevoke.publicKey)).toBeNull();

    // Reclaim IP
    allocatedIps = allocatedIps.filter((ip) => ip !== deviceToRevoke.tunnelIp);
    userDevices = userDevices.filter((d) => d.deviceId !== deviceToRevoke.deviceId);

    expect(userDevices).toHaveLength(1);
    expect(allocatedIps).not.toContain('10.50.0.2');

    // Step 5: User adds Device 3 (Tablet) -> Reallocates lowest free IP (10.50.0.2)
    const dev3 = await manager.provisionPeer({
      deviceId: 'tablet-uuid-3',
      deviceName: 'iPad Pro',
      existingAllocatedIps: allocatedIps,
    });

    allocatedIps.push(dev3.tunnelIp);
    userDevices.push({
      deviceId: 'tablet-uuid-3',
      name: 'iPad Pro',
      publicKey: dev3.publicKey,
      tunnelIp: dev3.tunnelIp,
    });

    // Subnet allocator successfully reused 10.50.0.2 without any address collision!
    expect(dev3.tunnelIp).toBe('10.50.0.2');
    expect(await manager.getPeer(dev3.publicKey)).toBeDefined();
    expect(userDevices).toHaveLength(2);
  });
});
