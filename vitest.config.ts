import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@bharattunnel/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@bharattunnel/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@bharattunnel/wireguard': path.resolve(__dirname, './packages/wireguard/src/index.ts'),
    },
  },
});
