import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import * as path from 'path';

// Load .env file from root or current directory
loadDotenv({ path: path.resolve(process.cwd(), '.env') });
loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  
  DATABASE_URL: z.string().default('postgresql://bharat:tunnel_secret@localhost:5432/bharattunnel?schema=public'),

  JWT_SECRET: z.string().min(16).default('dev_jwt_secret_must_be_over_32_characters_long_for_security_12345'),
  SESSION_SECRET: z.string().min(16).default('dev_session_secret_must_be_over_32_characters_long_for_sec_12345'),
  COOKIE_SECRET: z.string().min(16).default('dev_cookie_secret_must_be_over_32_characters_long_for_sec_12345'),

  VPN_SERVER_HOST: z.string().default('127.0.0.1'),
  VPN_SERVER_PORT: z.coerce.number().default(51820),
  VPN_SERVER_PUBLIC_KEY: z.string().default('YWRtaW4td2ctcHViLWtleS1zYW1wbGUtZGF0YS0xMjM0NTY3OA=='),
  VPN_NETWORK: z.string().default('10.50.0.0/24'),
  VPN_GATEWAY_IP: z.string().default('10.50.0.1'),
  VPN_DNS_SERVER: z.string().default('10.50.0.1,1.1.1.1'),
  VPN_INTERFACE: z.string().default('wg0'),

  WIREGUARD_DRIVER: z.enum(['system', 'mock']).default('mock'),

  MAX_DEVICES_PER_USER: z.coerce.number().int().min(1).max(10).default(2),
  MONTHLY_BANDWIDTH_GB: z.coerce.number().min(1).default(50),
  MAX_ACTIVE_SESSIONS: z.coerce.number().int().min(1).default(2),

  ADMIN_EMAIL: z.string().email().default('admin@bharattunnel.in'),
  ADMIN_INITIAL_PASSWORD: z.string().min(8).default('BharatTunnelAdmin2026!'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

export const appConfig = parsedEnv.data;
export type AppConfig = z.infer<typeof envSchema>;
