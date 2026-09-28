import { describe, it, expect } from 'vitest';
import {
  generateWireGuardKeyPair,
  generatePresharedKey,
  isValidWireGuardKey,
} from '@bharattunnel/wireguard';

describe('WireGuard Cryptographic Keygen', () => {
  it('generates valid RFC 7748 Curve25519 key pairs', () => {
    const keyPair = generateWireGuardKeyPair();

    expect(keyPair.privateKey).toHaveLength(44);
    expect(keyPair.publicKey).toHaveLength(44);
    expect(keyPair.privateKey.endsWith('=')).toBe(true);
    expect(keyPair.publicKey.endsWith('=')).toBe(true);

    expect(isValidWireGuardKey(keyPair.privateKey)).toBe(true);
    expect(isValidWireGuardKey(keyPair.publicKey)).toBe(true);
  });

  it('verifies RFC 7748 bit clamping on generated private keys', () => {
    for (let i = 0; i < 20; i++) {
      const keyPair = generateWireGuardKeyPair();
      const privBytes = Buffer.from(keyPair.privateKey, 'base64');

      expect(privBytes).toHaveLength(32);
      // Bit 0, 1, 2 of byte 0 must be 0
      expect(privBytes[0] & 7).toBe(0);
      // Bit 7 of byte 31 must be 0
      expect(privBytes[31] & 128).toBe(0);
      // Bit 6 of byte 31 must be 1
      expect(privBytes[31] & 64).toBe(64);
    }
  });

  it('generates valid 32-byte WireGuard preshared keys', () => {
    const psk = generatePresharedKey();
    expect(psk).toHaveLength(44);
    expect(psk.endsWith('=')).toBe(true);
    expect(isValidWireGuardKey(psk)).toBe(true);
  });

  it('rejects invalid or forged WireGuard keys', () => {
    expect(isValidWireGuardKey('')).toBe(false);
    expect(isValidWireGuardKey('short')).toBe(false);
    expect(isValidWireGuardKey('not_base_64_characters!@#$%^&*()_+====')).toBe(false);
    // Key that is not 32 bytes (e.g. 16 bytes base64)
    expect(isValidWireGuardKey('MDEyMzQ1Njc4OWFiY2RlZg==')).toBe(false);
  });
});
