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

  it('defines the table room type', async () => {
    const room = await env.sdk.create('table', {});
    expect(room.roomId).toBeTruthy();
    await room.leave();
  });
});
