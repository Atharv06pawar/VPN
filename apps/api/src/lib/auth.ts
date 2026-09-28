import * as crypto from 'crypto';

let argon2Module: any = null;
async function getArgon2() {
  if (argon2Module === null) {
    try {
      argon2Module = await import('@node-rs/argon2');
    } catch {
      argon2Module = false;
    }
  }
  return argon2Module;
}

/**
 * Hashes a plaintext password using Argon2id (or scrypt fallback).
 */
export async function hashPassword(password: string): Promise<string> {
  const argon = await getArgon2();
  if (argon && argon.hash) {
    return argon.hash(password, {
      memoryCost: 65536,
      timeCost: 3,
      outputLen: 32,
      parallelism: 4,
    });
  }

  // Cryptographically robust fallback using Node.js crypto.scrypt
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored hash using timing-safe comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('scrypt:')) {
    const [, salt, expectedKey] = storedHash.split(':');
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return reject(err);
        const keyBuffer = Buffer.from(expectedKey, 'hex');
        if (derivedKey.length !== keyBuffer.length) {
          return resolve(false);
        }
        resolve(crypto.timingSafeEqual(derivedKey, keyBuffer));
      });
    });
  }

  const argon = await getArgon2();
  if (argon && argon.verify) {
    try {
      return await argon.verify(storedHash, password);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Generates a high-entropy session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 hash of a session token for storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
