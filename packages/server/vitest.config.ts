import { defineConfig } from 'vitest/config';

// Server tests boot a real Colyseus server and drive real WebSocket clients, so
// they are slower than pure-logic suites and must run one file at a time — two
// suites booting on the same port would collide and fail for the wrong reason.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    bail: 0,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globals: false,
    // One suite at a time: each boots a real Colyseus server, and two racing for
    // the same port would fail for a reason that has nothing to do with the code.
    fileParallelism: false,
    // Threads, not forks. @colyseus/tools signals PM2 readiness with
    // `process.send({...})`, and inside a vitest FORK `process.send` is
    // vitest's own IPC channel — it receives a plain object where it expects a
    // Buffer and dies with ERR_INVALID_ARG_TYPE before a single test runs.
    // Worker threads have no `process.send`, so Colyseus skips that path.
    pool: 'threads',
  },
});
