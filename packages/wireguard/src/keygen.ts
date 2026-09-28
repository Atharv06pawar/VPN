import * as crypto from 'crypto';
import { WIREGUARD_KEY_REGEX } from '@bharattunnel/shared';

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Generates an RFC 7748 Curve25519 key pair formatted for WireGuard (32 bytes, Base64-encoded, 44 chars).
 * Performs RFC 7748 bit clamping on the private key.
 */
export function generateWireGuardKeyPair(): WireGuardKeyPair {
  // Generate random 32 bytes for private key
  const privBytes = crypto.randomBytes(32);
  
  // RFC 7748 Curve25519 clamping
  privBytes[0] &= 248;
  privBytes[31] &= 127;
  privBytes[31] |= 64;

  // Import into Node crypto to compute the corresponding x25519 public key
  const privKeyObj = crypto.createPrivateKey({
    key: Buffer.concat([
      // PKCS#8 prefix for X25519 (16 bytes)
      Buffer.from('302e020100300506032b656e04220420', 'hex'),
      privBytes,
    ]),
    format: 'der',
    type: 'pkcs8',
  });

  const pubKeyObj = crypto.createPublicKey(privKeyObj);
  const pubDer = pubKeyObj.export({ type: 'spki', format: 'der' });
  const pubBytes = pubDer.subarray(-32);

  return {
    privateKey: privBytes.toString('base64'),
    publicKey: pubBytes.toString('base64'),
  };
}

/**
 * Generates a WireGuard preshared key (32 random bytes Base64-encoded).
 */
export function generatePresharedKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Validates whether a given string is a valid 44-character Base64 WireGuard key.
 */
export function isValidWireGuardKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (!WIREGUARD_KEY_REGEX.test(key)) return false;

  try {
    const buf = Buffer.from(key, 'base64');
    return buf.length === 32;
  } catch {
    return false;
  }
}
