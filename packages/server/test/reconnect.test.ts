import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';
import { record, sleep } from './util.js';
import type { LobbyMessage, SeatStatusMessage } from '../src/protocol.js';
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

describe('disconnect and rejoin', () => {
  it('holds the seat, tells the table, and keeps the game moving', async () => {
    const host = await env.sdk.create('table', {
      playerId: 'p0', name: 'Ann', __test: { ...FAST, turnSeconds: 600 },
    });
    const guest = await env.sdk.joinById(host.roomId, { playerId: 'p1', name: 'Bo' });
    const hostLog = record(host);
    const guestLog = record(guest);

    host.send('fill-bot', { seat: 2 });
    host.send('fill-bot', { seat: 3 });
    await hostLog.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
    host.send('start', {});
    await guestLog.next<PlayerView>('view');

    // Bo drops mid-hand.
    await guest.leave(false);
    const status = await hostLog.next<SeatStatusMessage>(
      'seat-status', (m) => m.seat === 1 && m.connected === false,
    );
    expect(status).toEqual({ seat: 1, connected: false });

    // The seat is HELD, not freed — the lobby still shows a human there.
    const lobby = await hostLog.next<LobbyMessage>(
      'lobby', (m) => m.seats[1]?.connected === false,
    );
    expect(lobby.seats[1]).toMatchObject({ kind: 'human', name: 'Bo', connected: false });

    // Bo comes back with the same playerId and gets the same seat, plus the
    // current position immediately rather than waiting for someone to move.
    const rejoined = await env.sdk.joinById(host.roomId, { playerId: 'p1', name: 'Bo' });
    const rejoinLog = record(rejoined);
    const view = await rejoinLog.next<PlayerView>('view');
    expect(view.seat).toBe(1);
    expect(await hostLog.next<SeatStatusMessage>(
      'seat-status', (m) => m.seat === 1 && m.connected === true,
    )).toEqual({ seat: 1, connected: true });
  });

  it('a bot covers the dropped seat so the others never wait', async () => {
    const host = await env.sdk.create('table', {
      playerId: 'p0', name: 'Ann', __test: FAST,
    });
    const guest = await env.sdk.joinById(host.roomId, { playerId: 'p1', name: 'Bo' });
    const hostLog = record(host);

    host.send('fill-bot', { seat: 2 });
    host.send('fill-bot', { seat: 3 });
    await hostLog.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
    host.send('start', {});
    await hostLog.next<PlayerView>('view');

    await guest.leave(false);

    // Nobody sends another action. With seat 1 covered and seat 0's turns
    // auto-played, the hand must still finish on its own.
    for (let i = 0; i < 1500 && hostLog.count('hand-result') === 0; i++) await sleep(5);
    expect(
      hostLog.count('hand-result'),
      'the table stalled after a player dropped',
    ).toBeGreaterThan(0);
  });

  it('frees the seat instead when the drop happens in the lobby', async () => {
    const host = await env.sdk.create('table', { playerId: 'p0', name: 'Ann' });
    const guest = await env.sdk.joinById(host.roomId, { playerId: 'p1', name: 'Bo' });
    const hostLog = record(host);
    await hostLog.next<LobbyMessage>('lobby', (m) => m.seats[1]?.kind === 'human');

    await guest.leave();
    const lobby = await hostLog.next<LobbyMessage>('lobby', (m) => m.seats[1]?.kind === 'empty');
    expect(lobby.seats[1]).toMatchObject({ kind: 'empty', name: null });
  });
});

describe('timers', () => {
  it('covers a human who never answers their turn', async () => {
    const room = await env.sdk.create('table', {
      playerId: 'p0', name: 'Ann',
      __test: { turnSeconds: 1, claimSeconds: 1, botDelayMs: 0, interHandMs: 0 },
    });
    const log = record(room);
    room.send('fill-bot', { seat: 1 });
    room.send('fill-bot', { seat: 2 });
    room.send('fill-bot', { seat: 3 });
    await log.next<LobbyMessage>('lobby', (m) => m.seats.every((s) => s.kind !== 'empty'));
    room.send('start', {});

    const first = await log.next<PlayerView>('view');
    expect(first.turn).toBe(0);
    expect(first.legalActions.length).toBeGreaterThan(0);

    // Send nothing. Within a few seconds the turn timer must have played for
    // seat 0 and moved the table on.
    const before = log.count('view');
    await sleep(3500);
    expect(
      log.count('view'),
      'the turn timer never fired — a silent player would freeze the table forever',
    ).toBeGreaterThan(before);
  });
});
