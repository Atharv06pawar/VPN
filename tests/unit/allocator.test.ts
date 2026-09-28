import { describe, it, expect } from 'vitest';
import { IpAllocator } from '@bharattunnel/wireguard';

describe('IpAllocator', () => {
  it('correctly calculates total capacity for /24 network excluding network, broadcast, and gateway', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    // 256 total - 1 network (10.50.0.0) - 1 broadcast (10.50.0.255) - 1 gateway (10.50.0.1) = 253 hosts
    expect(allocator.getTotalCapacity()).toBe(253);
  });

  it('allocates the first available client IP (10.50.0.2)', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    const allocated = allocator.allocateNextIp([]);
    expect(allocated).toBe('10.50.0.2');
  });

  it('skips already allocated IPs and assigns the next free address', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    const allocated = allocator.allocateNextIp(['10.50.0.2', '10.50.0.3']);
    expect(allocated).toBe('10.50.0.4');
  });

  it('re-allocates a released IP when a gap exists', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    // 10.50.0.2 was released, 10.50.0.3 is still active
    const allocated = allocator.allocateNextIp(['10.50.0.3', '10.50.0.4']);
    expect(allocated).toBe('10.50.0.2');
  });

  it('recognizes subnet boundaries correctly', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    expect(allocator.isIpInSubnet('10.50.0.45')).toBe(true);
    expect(allocator.isIpInSubnet('10.50.1.1')).toBe(false);
    expect(allocator.isIpInSubnet('192.168.1.1')).toBe(false);
  });

  it('flags reserved addresses', () => {
    const allocator = new IpAllocator({
      cidr: '10.50.0.0/24',
      gatewayIp: '10.50.0.1',
    });

    expect(allocator.isIpReserved('10.50.0.0')).toBe(true);   // network
    expect(allocator.isIpReserved('10.50.0.1')).toBe(true);   // gateway
    expect(allocator.isIpReserved('10.50.0.255')).toBe(true); // broadcast
    expect(allocator.isIpReserved('10.50.0.2')).toBe(false);  // assignable host
  });

  it('throws an error if subnet pool is exhausted', () => {
    // /30 network has only 2 usable hosts: .1 (gateway) and .2 (client)
    const smallAllocator = new IpAllocator({
      cidr: '10.50.0.0/30',
      gatewayIp: '10.50.0.1',
    });

    const first = smallAllocator.allocateNextIp([]);
    expect(first).toBe('10.50.0.2');

    expect(() => {
      smallAllocator.allocateNextIp(['10.50.0.2']);
    }).toThrow(/exhausted/);
  });
});
