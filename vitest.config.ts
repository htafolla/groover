import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'deploy/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Deploy tests share repertoire/data/curated_signals.json — serialize file runs.
    fileParallelism: false,
  },
});
