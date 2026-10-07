import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});