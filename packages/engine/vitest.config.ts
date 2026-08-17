import { defineConfig } from 'vitest/config';

// Loud-by-default test config.
//
// `bail: 0` means one failure never hides the others — when the engine breaks we
// want the full list of what broke, not the first line of it. The raised
// `testTimeout` exists for `test/simulation.test.ts`, which plays 200 complete
// hands and legitimately runs longer than Vitest's 5s default; without it a slow
// machine would report a *timeout* instead of the real assertion failure, which
// is exactly the kind of quiet, misleading failure this project forbids.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    bail: 0,
    testTimeout: 120_000,
    hookTimeout: 30_000,
    // No global mocking helpers are configured anywhere in this package, and no
    // test may introduce them: every test drives the real engine with real
    // tiles. See test/support/assert.ts for the failure-message conventions.
    globals: false,
  },
});
