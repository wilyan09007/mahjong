import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';
import { record, sleep } from './util.js';
import type {
  HandResultMessage, LobbyMessage, SessionEndMessage,
} from '../src/protocol.js';
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

describe('multi-hand sessions', () => {
  it('plays a full round, then reports standings and returns to the lobby', async () => {
    const room = await env.sdk.create('table', {
      playerId: 'human', name: 'Ann',
      __test: { turnSeconds: 0, claimSeconds: 0, botDelayMs: 0, interHandMs: 0 },
    });
    const log = record(room);
    for (const seat of [1, 2, 3]) room.send('fill-bot', { seat });
    await log.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
    room.send('config', { totalRounds: 1 });
    await log.next<LobbyMessage>('lobby', (m) => m.config.totalRounds === 1);
    room.send('start', {});

    // The human plays whatever it is offered; the timer covers it otherwise.
    for (let step = 0; step < 4000 && log.count('session-end') === 0; step++) {
      const view = log.latest<PlayerView>('view');
      if (view && view.legalActions.length > 0) {
        room.send('action', { action: view.legalActions[0] });
      }
      await sleep(3);
    }

    const end = log.latest<SessionEndMessage>('session-end');
    expect(end, 'the session never ended').toBeDefined();

    // A full lap moves the deal through all four seats, so at least four hands.
    const hands = log.all('hand-result') as HandResultMessage[];
    expect(hands.length, `only ${hands.length} hands played in a full round`)
      .toBeGreaterThanOrEqual(4);

    // Standings are sorted, cover every seat, and sum to zero — points only
    // ever move between players.
    expect(end!.standings).toHaveLength(4);
    const scores = end!.standings.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
    expect(new Set(end!.standings.map((s) => s.seat)).size).toBe(4);

    // And they agree with the last running total the server broadcast.
    const finalScores = hands.at(-1)!.scores;
    for (const standing of end!.standings) {
      expect(standing.score).toBe(finalScores[standing.seat]);
    }

    // Back in the lobby with seats intact, ready to play again.
    const lobby = await log.next<LobbyMessage>(
      'lobby', (m) => m.seats.every((s) => s.kind !== 'empty'), 5000,
    );
    expect(lobby.seats.filter((s) => s.kind === 'bot')).toHaveLength(3);
    expect(lobby.seats[0]).toMatchObject({ kind: 'human', name: 'Ann' });
  });

  it('running scores stay zero-sum after every single hand', async () => {
    const room = await env.sdk.create('table', {
      playerId: 'human', name: 'Ann',
      __test: { turnSeconds: 0, claimSeconds: 0, botDelayMs: 0, interHandMs: 0 },
    });
    const log = record(room);
    for (const seat of [1, 2, 3]) room.send('fill-bot', { seat });
    await log.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
    room.send('start', {});

    for (let step = 0; step < 3000 && log.count('hand-result') < 3; step++) {
      const view = log.latest<PlayerView>('view');
      if (view && view.legalActions.length > 0) {
        room.send('action', { action: view.legalActions[0] });
      }
      await sleep(3);
    }

    const hands = log.all('hand-result') as HandResultMessage[];
    expect(hands.length).toBeGreaterThanOrEqual(1);
    for (const [i, hand] of hands.entries()) {
      expect(hand.scores.reduce((a, b) => a + b, 0), `hand ${i} scores do not net to zero`)
        .toBe(0);
      if (hand.result.type === 'win') {
        expect(hand.result.payments.reduce((a, b) => a + b, 0)).toBe(0);
        expect(hand.result.breakdown.reduce((n, b) => n + b.tai, 0)).toBe(hand.result.tai);
      }
    }
  });
});
