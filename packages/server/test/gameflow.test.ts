import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import appConfig from '../src/app.config.js';
import { record, assertNoHiddenInfo, type Recorder } from './util.js';
import type { HandResultMessage, LobbyMessage } from '../src/protocol.js';
import type { PlayerView } from '@mahjong/engine';

let env: ColyseusTestServer;

beforeAll(async () => {
  env = await boot(appConfig);
});
afterEach(async () => {
  await env.cleanup();
});
afterAll(async () => {
  await env.shutdown();
});

const FAST = { turnSeconds: 0, claimSeconds: 0, botDelayMs: 0, interHandMs: 0 };

/** Seat four humans at one table and start the hand. */
async function seatFourHumans(
  overrides: Partial<typeof FAST> = FAST,
): Promise<{ rooms: Room[]; logs: Recorder[] }> {
  const host = await env.sdk.create('table', {
    playerId: 'p0', name: 'Ann', __test: { ...FAST, ...overrides, turnSeconds: 600 },
  });
  const rooms = [host];
  for (let i = 1; i < 4; i++) {
    rooms.push(await env.sdk.joinById(host.roomId, { playerId: `p${i}`, name: `P${i}` }));
  }
  const logs = rooms.map((r) => record(r));
  await logs[3]!.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind === 'human'));
  host.send('start', {});
  return { rooms, logs };
}

describe('game flow over the wire', () => {
  it('4 humans play a full hand, and no view ever leaks hidden information', async () => {
    const { rooms, logs } = await seatFourHumans();

    let handResult: HandResultMessage | null = null;
    for (let step = 0; step < 900 && handResult === null; step++) {
      // Whoever the server says can act, acts.
      let acted = false;
      for (let seat = 0; seat < 4; seat++) {
        const view = logs[seat]!.latest<PlayerView>('view');
        if (!view) continue;
        assertNoHiddenInfo(view, `seat ${seat} view`);
        if (view.legalActions.length === 0) continue;
        rooms[seat]!.send('action', { action: view.legalActions[0] });
        acted = true;
        break;
      }
      if (!acted) await new Promise((r) => setTimeout(r, 10));
      handResult = logs[0]!.latest<HandResultMessage>('hand-result') ?? null;
      if (handResult) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    expect(handResult, 'the hand never finished').not.toBeNull();
    expect(handResult!.scores.reduce((a, b) => a + b, 0)).toBe(0);
    expect(handResult!.result.type === 'win' || handResult!.result.type === 'draw-exhausted')
      .toBe(true);

    // Every single view any client received must have been clean.
    for (let seat = 0; seat < 4; seat++) {
      for (const view of logs[seat]!.all('view')) {
        assertNoHiddenInfo(view, `seat ${seat} historical view`);
      }
      expect(logs[seat]!.count('view')).toBeGreaterThan(0);
    }
  });

  it('a client cannot play for a seat it does not own', async () => {
    const { rooms, logs } = await seatFourHumans();
    const view0 = await logs[0]!.next<PlayerView>('view');
    expect(view0.seat).toBe(0);

    // Seat 1 tries to play seat 0's action.
    rooms[1]!.send('action', { action: { ...view0.legalActions[0]!, seat: 0 } });
    const error = await logs[1]!.next<{ message: string }>('error');
    expect(error.message).toMatch(/cannot play for seat 0/);
  });

  it('an illegal action is rejected AND the client is re-synced', async () => {
    const { rooms, logs } = await seatFourHumans();
    await logs[1]!.next<PlayerView>('view');
    logs[1]!.clear('view');

    // Seat 1 discards out of turn (it is the dealer's turn at hand start).
    rooms[1]!.send('action', { action: { type: 'discard', seat: 1, tile: '1w' } });
    const error = await logs[1]!.next<{ message: string }>('error');
    expect(error.message.length).toBeGreaterThan(0);
    // The server re-sends the truth so a desynced client heals itself.
    const resync = await logs[1]!.next<PlayerView>('view');
    assertNoHiddenInfo(resync, 'resync view');
    expect(resync.seat).toBe(1);
  });

  it('each seat sees only its own hand, and the counts add up', async () => {
    const { logs } = await seatFourHumans();
    const views = await Promise.all([0, 1, 2, 3].map((s) => logs[s]!.next<PlayerView>('view')));
    for (const view of views) {
      expect(view.opponents).toHaveLength(3);
      const total = view.hand.length + view.opponents.reduce((n, o) => n + o.handCount, 0);
      expect(total, 'concealed tiles across the table should be 16*4 + 1 for the dealer')
        .toBe(65);
    }
    // Two different seats must not have been handed the same hand.
    expect(views[0]!.hand).not.toEqual(views[1]!.hand);
  });

  it('rejects an action when no hand is running', async () => {
    const host = await env.sdk.create('table', { playerId: 'p0', name: 'Ann' });
    const log = record(host);
    host.send('action', { action: { type: 'discard', seat: 0, tile: '1w' } });
    expect((await log.next<{ message: string }>('error')).message).toMatch(/no hand/);
  });

  it('passes emotes through, rate-limited to one per second per seat', async () => {
    const { rooms, logs } = await seatFourHumans();
    rooms[0]!.send('emote', { emote: '👍' });
    const first = await logs[1]!.next<{ seat: number; emote: string }>('emote');
    expect(first).toEqual({ seat: 0, emote: '👍' });

    rooms[0]!.send('emote', { emote: '🎉' });
    rooms[0]!.send('emote', { emote: '🎉' });
    await new Promise((r) => setTimeout(r, 150));
    expect(logs[1]!.count('emote'), 'rate limit did not hold').toBe(1);
  });
});
