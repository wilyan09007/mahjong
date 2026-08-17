import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';

let env: ColyseusTestServer;

beforeAll(async () => {
  env = await boot(appConfig);
});

afterAll(async () => {
  await env.shutdown();
});

describe('server scaffold', () => {
  it('serves the health endpoint Fly.io checks', async () => {
    const response = await env.http.get('/health');
    expect(response.data).toEqual({ ok: true });
  });

  it('defines the table room type, keyed by a join code', async () => {
    const room = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    expect(room.roomId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await room.leave();
  });

  it('refuses a join with no playerId, rather than seating a ghost', async () => {
    // Identity is by playerId, not by connection — it is what makes a seat
    // reclaimable after a disconnect. A join without one has no seat to return
    // to, so it is rejected at the door.
    await expect(env.sdk.create('table', {})).rejects.toThrow(/playerId/);
  });
});
