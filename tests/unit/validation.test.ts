import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  CreateDeviceSchema,
  DEVICE_NAME_REGEX,
} from '@bharattunnel/shared';

describe('Shared Validation Schemas & Sanitization', () => {
  describe('RegisterSchema', () => {
    it('accepts valid student credentials', () => {
      const valid = {
        fullName: 'Aarav Patel',
        email: 'aarav@university.ru',
        password: 'SecurePassword123!',
      };

      const result = RegisterSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects passwords missing required entropy', () => {
      const weakPassword = {
        fullName: 'Aarav Patel',
        email: 'aarav@university.ru',
        password: 'password', // no uppercase, no number, no symbol
      };

      const result = RegisterSchema.safeParse(weakPassword);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email formats', () => {
      const invalidEmail = {
        fullName: 'Aarav Patel',
        email: 'not-an-email',
        password: 'SecurePassword123!',
      };

      const result = RegisterSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateDeviceSchema & DEVICE_NAME_REGEX', () => {
    it('accepts clean device names', () => {
      const names = [
        'Russian Dorm Laptop',
        'iPhone-14_Pro',
        'ThinkPad.X1',
        'Android Phone 2',
      ];

      for (const name of names) {
        expect(DEVICE_NAME_REGEX.test(name)).toBe(true);
        expect(CreateDeviceSchema.safeParse({ name }).success).toBe(true);
      }
    });

    it('rejects dangerous characters that could attempt shell injection', () => {
      const dangerousNames = [
        'Laptop; rm -rf /',
        'Laptop && cat /etc/passwd',
        'Laptop | whoami',
        'Laptop`reboot`',
        'Laptop $(id)',
        'Laptop\nnew-line',
        'A', // Too short (min 2)
        'A'.repeat(51), // Too long (max 50)
      ];

      for (const name of dangerousNames) {
        expect(DEVICE_NAME_REGEX.test(name)).toBe(false);
        expect(CreateDeviceSchema.safeParse({ name }).success).toBe(false);
      }
    });
  });
});
