import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'deploy/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Deploy tests use CURATED_SIGNALS_PATH sandboxes — safe to parallelize.
    fileParallelism: true,
  },
});
