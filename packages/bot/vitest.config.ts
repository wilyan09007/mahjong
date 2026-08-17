import { defineConfig } from 'vitest/config';

// Same loud-by-default posture as the engine: one failure never hides the
// others, and the property tests here play thousands of real hands so they
// need more than Vitest's 5s default.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    bail: 0,
    testTimeout: 120_000,
    globals: false,
  },
});
