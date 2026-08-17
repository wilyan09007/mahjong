import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';
import { record, assertNoHiddenInfo, sleep, type Recorder } from './util.js';
import type { LobbyMessage, SessionEndMessage } from '../src/protocol.js';
import type { PlayerView } from '@mahjong/engine';

let env: ColyseusTestServer;

beforeAll(async () => {
  env = await boot(appConfig);
});
afterAll(async () => {
  await env.shutdown();
});

/**
 * Three tables at once, each a human plus three bots, played to session end.
 *
 * The point is not throughput — it is that rooms are genuinely independent.
 * A room-scoped bug (a shared timer, a module-level game reference, a
 * broadcast that escapes its room) shows up here and nowhere else, because
 * every other test runs one table at a time.
 */
describe('multi-room soak', () => {
  it('runs 3 concurrent tables to session end without cross-talk or leaks', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onRejection);

    try {
      const tables = await Promise.all([0, 1, 2].map(async (t) => {
        const room = await env.sdk.create('table', {
          playerId: `human-${t}`,
          name: `Player ${t}`,
          __test: { turnSeconds: 0, claimSeconds: 0, botDelayMs: 0, interHandMs: 0 },
        });
        const log = record(room);
        for (const seat of [1, 2, 3]) room.send('fill-bot', { seat });
        await log.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
        room.send('config', { totalRounds: 1 });
        await log.next<LobbyMessage>('lobby', (m) => m.config.totalRounds === 1);
        room.send('start', {});
        return { index: t, room, log, code: room.roomId };
      }));

      // Every table has its own code.
      const codes = tables.map((t) => t.code);
      expect(new Set(codes).size, `rooms shared a code: ${codes.join(',')}`).toBe(3);

      // Drive all three at once until each reports a session end.
      for (let step = 0; step < 6000; step++) {
        if (tables.every((t) => t.log.count('session-end') > 0)) break;
        for (const table of tables) {
          if (table.log.count('session-end') > 0) continue;
          const view = table.log.latest<PlayerView>('view');
          if (view && view.legalActions.length > 0) {
            table.room.send('action', { action: view.legalActions[0] });
          }
        }
        await sleep(3);
      }

      for (const table of tables) {
        const end = table.log.latest<SessionEndMessage>('session-end');
        expect(end, `table ${table.index} never finished its session`).toBeDefined();
        expect(end!.standings).toHaveLength(4);
        expect(end!.standings.reduce((n, s) => n + s.score, 0)).toBe(0);

        // Cross-talk: this client is seat 0 of its OWN room and must never have
        // been handed a view belonging to another seat or another table.
        const views = table.log.all('view') as PlayerView[];
        expect(views.length, `table ${table.index} received no views`).toBeGreaterThan(0);
        for (const view of views) {
          expect(view.seat, `table ${table.index} got another seat's view`).toBe(0);
          assertNoHiddenInfo(view, `soak table ${table.index}`);
        }

        // Documented shapes: every hand-result carries a real result + scores.
        for (const raw of table.log.all('hand-result')) {
          const hand = raw as { result: { type: string }; scores: number[] };
          expect(['win', 'draw-exhausted']).toContain(hand.result.type);
          expect(hand.scores).toHaveLength(4);
          expect(hand.scores.reduce((a, b) => a + b, 0)).toBe(0);
        }
      }

      expect(
        rejections,
        `unhandled rejections during the soak: ${rejections.map(String).join(' | ')}`,
      ).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });
});
