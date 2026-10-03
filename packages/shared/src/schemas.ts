import { z } from 'zod';

// Strict WireGuard Curve25519 base64 regex (exactly 44 chars, ending in '=')
export const WIREGUARD_KEY_REGEX = /^[A-Za-z0-9+/]{43}=$/;

// Standard IPv4 regex (1.0.0.0 to 255.255.255.255)
export const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// Strict device name regex: alphanumeric, spaces, hyphens, underscores, dots. Length 2 to 50 chars.
// Prevents any shell injection, carriage returns, or control characters.
export const DEVICE_NAME_REGEX = /^[a-zA-Z0-9_\-. ]{2,50}$/;

export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255).toLowerCase(),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const CreateDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Device name must be at least 2 characters')
    .max(50, 'Device name cannot exceed 50 characters')
    .regex(
      DEVICE_NAME_REGEX,
      'Device name can only contain letters, numbers, spaces, underscores, hyphens, and dots'
    ),
  // Optional client-generated public key. If omitted, the server will generate a keypair.
  publicKey: z
    .string()
    .trim()
    .regex(WIREGUARD_KEY_REGEX, 'Public key must be a valid 44-character base64 Curve25519 WireGuard key')
    .optional(),
});

export const RevokeDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID format'),
});

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(255).optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const CreateVoucherSchema = z.object({
  studentName: z.string().trim().min(2, 'Student name must be at least 2 characters').max(100),
  telegramHandle: z.string().trim().max(100).optional(),
  telegramChatId: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(255).optional(),
  validityDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const RenewVoucherSchema = z.object({
  additionalDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const Admin2faLoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits').optional(),
});

export const Setup2faVerifySchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export const ClaimVoucherSchema = z.object({
  code: z.string().trim().min(4, 'Voucher code is required').max(64),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateDeviceInput = z.infer<typeof CreateDeviceSchema>;
export type RevokeDeviceInput = z.infer<typeof RevokeDeviceSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type CreateVoucherInput = z.infer<typeof CreateVoucherSchema>;
export type RenewVoucherInput = z.infer<typeof RenewVoucherSchema>;
export type Admin2faLoginInput = z.infer<typeof Admin2faLoginSchema>;
export type Setup2faVerifyInput = z.infer<typeof Setup2faVerifySchema>;
export type ClaimVoucherInput = z.infer<typeof ClaimVoucherSchema>;
