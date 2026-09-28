import { describe, it, expect } from 'vitest';
import { sanitizeLogData } from '../../apps/api/src/lib/logger.js';
import { hashPassword, verifyPassword } from '../../apps/api/src/lib/auth.js';

describe('Security & Privacy Audit: Logging Redaction & Credential Defense', () => {
  it('strictly redacts WireGuard private keys and passwords from log objects', () => {
    const sensitivePayload = {
      email: 'student@example.ru',
      password: 'MySecretPassword123!',
      privateKey: 'YWRtaW4td2ctcHViLWtleS1zYW1wbGUtZGF0YS0xMjM0NTY3OA==',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig',
      nested: {
        token: 'secret-refresh-token',
        safeProperty: 'visible-value',
      },
    };

    const sanitized = sanitizeLogData(sensitivePayload) as any;

    expect(sanitized.email).toBe('student@example.ru');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.privateKey).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.nested.token).toBe('[REDACTED]');
    expect(sanitized.nested.safeProperty).toBe('visible-value');
  });

  it('redacts PrivateKey from raw WireGuard configuration strings', () => {
    const rawConf = `
[Interface]
PrivateKey = YWRtaW4td2ctcHViLWtleS1zYW1wbGUtZGF0YS0xMjM0NTY3OA==
Address = 10.50.0.2/32
`;
    const sanitized = sanitizeLogData(rawConf) as string;

    expect(sanitized).not.toContain('YWRtaW4td2ctcHViLWtleS1zYW1wbGUtZGF0YS0xMjM0NTY3OA==');
    expect(sanitized).toContain('PrivateKey = [REDACTED]');
  });

  it('hashes passwords securely with unique salts', async () => {
    const password = 'SuperSecretStudentPassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Two hashes of the same password must differ due to unique cryptographic salts
    expect(hash1).not.toBe(hash2);

    // Both must verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash1)).toBe(false);
  });
});
