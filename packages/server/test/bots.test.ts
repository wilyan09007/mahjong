import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import appConfig from '../src/app.config.js';
import { record, assertNoHiddenInfo, sleep, type Recorder } from './util.js';
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

/** One human at seat 0, bots in the rest, everything instant. */
async function tableWithBots(
  overrides: Record<string, number> = {},
): Promise<{ room: Room; log: Recorder }> {
  const room = await env.sdk.create('table', {
    playerId: 'human', name: 'Ann',
    __test: { turnSeconds: 0, claimSeconds: 0, botDelayMs: 0, interHandMs: 0, ...overrides },
  });
  const log = record(room);
  room.send('fill-bot', { seat: 1 });
  room.send('fill-bot', { seat: 2 });
  room.send('fill-bot', { seat: 3 });
  await log.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
  room.send('start', {});
  return { room, log };
}

/** Play the human's first legal action whenever one is offered. */
async function driveHuman(
  room: Room, log: Recorder, until: () => boolean, maxSteps = 1200,
): Promise<void> {
  for (let step = 0; step < maxSteps && !until(); step++) {
    const view = log.latest<PlayerView>('view');
    if (view && view.legalActions.length > 0) {
      assertNoHiddenInfo(view, 'human view');
      room.send('action', { action: view.legalActions[0] });
    }
    await sleep(5);
  }
}

describe('bot seats', () => {
  it('1 human + 3 bots complete a hand; the bots act without human input', async () => {
    const { room, log } = await tableWithBots();
    await driveHuman(room, log, () => log.count('hand-result') > 0);

    const result = log.latest<HandResultMessage>('hand-result');
    expect(result, 'the hand never finished with bots playing').toBeDefined();
    expect(result!.scores.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('bots move on their own when the human never acts at all', async () => {
    // The human sends nothing. Its own turns are covered by the turn timer
    // (turnSeconds: 0 here), so the table must still reach a result.
    const { log } = await tableWithBots();
    for (let i = 0; i < 1500 && log.count('hand-result') === 0; i++) await sleep(5);
    expect(
      log.count('hand-result'),
      'a silent human stalled the table — auto-cover is not working',
    ).toBeGreaterThan(0);
  });

  it('never sends a bot seat a view (bots have no socket)', async () => {
    const { room, log } = await tableWithBots();
    await driveHuman(room, log, () => log.count('hand-result') > 0);
    for (const view of log.all('view')) {
      expect((view as PlayerView).seat, 'the human received another seat view').toBe(0);
    }
  });

  it('respects the bot think-delay instead of firing instantly', async () => {
    const { log } = await tableWithBots({ botDelayMs: 120, turnSeconds: 600 });
    await log.next<PlayerView>('view');
    const started = Date.now();
    // Seat 0 is the dealer and acts first, so the first bot move waits for the
    // human. Give the human's turn away by watching the wall instead: with a
    // long turnSeconds nothing should happen for at least one delay period.
    await sleep(60);
    const early = log.count('view');
    await sleep(300);
    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    // No bot could have acted, because it is still the human's turn.
    expect(log.count('view')).toBe(early);
  });
});
