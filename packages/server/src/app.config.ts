import config from '@colyseus/tools';
import { TableRoom } from './TableRoom.js';

/**
 * The single server definition, shared by `index.ts` (which listens on a port)
 * and by every test (which boots it in-process via `@colyseus/testing`). Tests
 * therefore exercise the same wiring production runs, not a parallel setup that
 * can drift away from it.
 */
export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('table', TableRoom);
  },

  initializeExpress: (app) => {
    // Fly.io's health check hits this; it must stay dependency-free and fast.
    app.get('/health', (_req, res) => {
      res.json({ ok: true });
    });
  },
});
