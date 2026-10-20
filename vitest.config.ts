import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'apps/web/src/ui/**/*.test.{ts,tsx}'], environment: 'node' },
});
