import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup/to-equal-template.ts', './tests/setup/to-have-been-called-before.ts', './tests/setup/mock-cli-io.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
