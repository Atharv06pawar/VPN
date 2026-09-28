const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'authorization',
  'token',
  'accesstoken',
  'refreshtoken',
  'privatekey',
  'rawconfig',
  'cookie',
  'secret',
]);

/**
 * Deeply sanitizes objects to redact credentials, tokens, and cryptographic keys from all logs.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact Bearer tokens
    let sanitized = data.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    // Redact WireGuard private keys in key-value strings
    sanitized = sanitized.replace(/(PrivateKey\s*=\s*)[A-Za-z0-9+/=]{44}/gi, '$1[REDACTED]');
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = sanitizeLogData(value);
      }
    }
    return cleaned;
  }

  return data;
}

export const logger = {
  info: (msg: string, meta?: unknown) => {
    const metaStr = meta ? ` ${JSON.stringify(sanitizeLogData(meta))}` : '';
    console.log(`[INFO] [${new Date().toISOString()}] ${msg}${metaStr}`);
  },
  warn: (msg: string, meta?: unknown) => {
    const metaStr = meta ? ` ${JSON.stringify(sanitizeLogData(meta))}` : '';
    console.warn(`[WARN] [${new Date().toISOString()}] ${msg}${metaStr}`);
  },
  error: (msg: string, meta?: unknown) => {
    const metaStr = meta ? ` ${JSON.stringify(sanitizeLogData(meta))}` : '';
    console.error(`[ERROR] [${new Date().toISOString()}] ${msg}${metaStr}`);
  },
};
