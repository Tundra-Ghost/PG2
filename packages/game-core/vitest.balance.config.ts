import { defineConfig } from 'vitest/config';

// The balance run is a long offline job, not part of `pnpm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/balance.run.ts'],
    testTimeout: 0,
  },
});
