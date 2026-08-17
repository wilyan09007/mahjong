import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';
import { record } from './util.js';
import type { LobbyMessage, SeatPublic } from '../src/protocol.js';

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

describe('lobby', () => {
  it('host creates, friends join by code, seats fill in order', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const hostLog = record(host);
    const code = host.roomId;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const lobby1 = await hostLog.next<LobbyMessage>('lobby');
    expect(lobby1.seats[0]).toMatchObject({ kind: 'human', name: 'Ann', connected: true });
    expect(lobby1.code).toBe(code);

    const friend = await env.sdk.joinById(code, { playerId: 'p2', name: 'Bo' });
    const friendLog = record(friend);
    const lobby2 = await friendLog.next<LobbyMessage>(
      'lobby', (m) => m.seats[1]?.kind === 'human',
    );
    expect(lobby2.seats[1]).toMatchObject({ kind: 'human', name: 'Bo' });
    expect(lobby2.hostPlayerId).toBe('p1');
  });

  it('never hands out the same code to two rooms', async () => {
    const rooms = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        env.sdk.create('table', { playerId: `solo${i}`, name: `P${i}` })),
    );
    const codes = rooms.map((r) => r.roomId);
    expect(new Set(codes).size, `duplicate room codes: ${codes.join(',')}`).toBe(codes.length);
  });

  it('host fills bots and starts only with 4 seats filled', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const log = record(host);

    host.send('start', {});
    expect((await log.next<{ message: string }>('error')).message).toMatch(/4 seats/);

    host.send('fill-bot', { seat: 1 });
    host.send('fill-bot', { seat: 2 });
    host.send('fill-bot', { seat: 3 });
    const lobby = await log.next<LobbyMessage>(
      'lobby', (m) => m.seats.every((s: SeatPublic) => s.kind !== 'empty'),
    );
    expect(lobby.seats.filter((s) => s.kind === 'bot')).toHaveLength(3);
  });

  it('removes a bot again, freeing the seat', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const log = record(host);
    host.send('fill-bot', { seat: 2 });
    await log.next<LobbyMessage>('lobby', (m) => m.seats[2]?.kind === 'bot');
    host.send('remove-bot', { seat: 2 });
    const after = await log.next<LobbyMessage>('lobby', (m) => m.seats[2]?.kind === 'empty');
    expect(after.seats[2]).toMatchObject({ kind: 'empty', name: null });
  });

  it('rejects filling a seat that is already taken', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const log = record(host);
    host.send('fill-bot', { seat: 0 }); // the host's own seat
    expect((await log.next<{ message: string }>('error')).message).toMatch(/not empty/);
  });

  it('non-host cannot configure or start', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const friend = await env.sdk.joinById(host.roomId, { playerId: 'p2', name: 'Bo' });
    const friendLog = record(friend);

    friend.send('start', {});
    expect((await friendLog.next<{ message: string }>('error')).message).toMatch(/host/);

    friend.send('config', { totalRounds: 4 });
    expect(friendLog.count('error')).toBeGreaterThanOrEqual(1);
  });

  it('host configures the table and everyone sees it', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const friend = await env.sdk.joinById(host.roomId, { playerId: 'p2', name: 'Bo' });
    const friendLog = record(friend);

    host.send('config', { totalRounds: 4, base: 10, perTai: 5, turnSeconds: 15 });
    const lobby = await friendLog.next<LobbyMessage>('lobby', (m) => m.config.totalRounds === 4);
    expect(lobby.config).toMatchObject({
      totalRounds: 4, base: 10, perTai: 5, turnSeconds: 15,
    });
  });

  it('rejects nonsense configuration instead of accepting it quietly', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const log = record(host);

    host.send('config', { totalRounds: 3 as 1 | 2 | 4 });
    expect((await log.next<{ message: string }>('error')).message).toMatch(/1, 2 or 4/);

    log.clear('error');
    host.send('config', { base: -5 });
    expect((await log.next<{ message: string }>('error')).message).toMatch(/non-negative/);
  });

  it('holds a full table against a fifth player', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const code = host.roomId;
    await env.sdk.joinById(code, { playerId: 'p2', name: 'Bo' });
    await env.sdk.joinById(code, { playerId: 'p3', name: 'Cy' });
    await env.sdk.joinById(code, { playerId: 'p4', name: 'Di' });
    await expect(env.sdk.joinById(code, { playerId: 'p5', name: 'Ed' })).rejects.toThrow();
  });

  it('frees a seat when someone leaves the lobby, and passes the host on', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const friend = await env.sdk.joinById(host.roomId, { playerId: 'p2', name: 'Bo' });
    const friendLog = record(friend);
    await friendLog.next<LobbyMessage>('lobby', (m) => m.seats[1]?.kind === 'human');

    await host.leave();
    const after = await friendLog.next<LobbyMessage>('lobby', (m) => m.hostPlayerId === 'p2');
    expect(after.seats[0]).toMatchObject({ kind: 'empty' });
    expect(after.hostPlayerId).toBe('p2');
  });

  it('never puts a playerId on the wire', async () => {
    // Seats are public; player ids are not. Only the host id is shared, and
    // only because clients must know whether they are the host.
    const host = await env.sdk.create('table', { playerId: 'secret-1', name: 'Ann' });
    const friend = await env.sdk.joinById(host.roomId, { playerId: 'secret-2', name: 'Bo' });
    const friendLog = record(friend);
    const lobby = await friendLog.next<LobbyMessage>('lobby', (m) => m.seats[1]?.kind === 'human');
    const json = JSON.stringify(lobby.seats);
    expect(json).not.toContain('secret-1');
    expect(json).not.toContain('secret-2');
  });
});
