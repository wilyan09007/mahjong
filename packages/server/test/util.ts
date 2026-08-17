import type { Room } from 'colyseus.js';

/**
 * Message recording for tests.
 *
 * Subscribing at connect time and BUFFERING is the point. A helper that only
 * awaits the next message after it is called races the server: by the time a
 * test asks for the `lobby` that a `fill-bot` triggered, it has usually already
 * arrived. Buffering makes assertions about what was sent, not about timing.
 *
 * No mocking anywhere — these drive a real colyseus.js client over a real
 * socket against a real server.
 */
export interface Recorder {
  all(type: string): unknown[];
  latest<T = unknown>(type: string): T | undefined;
  count(type: string): number;
  clear(type?: string): void;
  /** Wait for a message of `type` matching `predicate`, or fail loudly. */
  next<T = unknown>(
    type: string,
    predicate?: (m: T) => boolean,
    timeoutMs?: number,
  ): Promise<T>;
}

const RECORDED = [
  'lobby', 'view', 'hand-result', 'seat-status', 'session-end', 'error', 'emote',
];

export function record(room: Room, types: string[] = RECORDED): Recorder {
  const buffers = new Map<string, unknown[]>();
  for (const type of types) {
    buffers.set(type, []);
    room.onMessage(type, (payload: unknown) => {
      buffers.get(type)!.push(payload);
    });
  }

  const all = (type: string): unknown[] => {
    const buf = buffers.get(type);
    if (!buf) throw new Error(`recorder is not listening for "${type}"`);
    return buf;
  };

  return {
    all,
    latest: <T,>(type: string) => all(type).at(-1) as T | undefined,
    count: (type: string) => all(type).length,
    clear: (type?: string) => {
      for (const key of type ? [type] : buffers.keys()) buffers.set(key, []);
    },
    async next<T>(
      type: string,
      predicate: (m: T) => boolean = () => true,
      timeoutMs = 8000,
    ): Promise<T> {
      const deadline = Date.now() + timeoutMs;
      let scanned = 0;
      for (;;) {
        const buf = all(type) as T[];
        for (; scanned < buf.length; scanned++) {
          if (predicate(buf[scanned]!)) return buf[scanned]!;
        }
        if (Date.now() > deadline) {
          throw new Error(
            `timed out after ${timeoutMs}ms waiting for a "${type}" message ` +
              `matching the predicate. Received ${buf.length}: ` +
              `${JSON.stringify(buf).slice(0, 500)}`,
          );
        }
        await sleep(10);
      }
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Every server→client message a test observes must be free of hidden
 * information. Call this on any `view` payload.
 */
export function assertNoHiddenInfo(payload: unknown, context: string): void {
  const json = JSON.parse(JSON.stringify(payload)) as Record<string, unknown> & {
    opponents?: { hand?: unknown; handCount?: unknown }[];
  };
  for (const forbidden of ['tiles', 'wallFront', 'wallBack', 'seed', 'players']) {
    if (json[forbidden] !== undefined) {
      throw new Error(`${context}: view leaked "${forbidden}"`);
    }
  }
  for (const opponent of json.opponents ?? []) {
    if (opponent.hand !== undefined) {
      throw new Error(`${context}: view leaked an opponent's hand`);
    }
    if (typeof opponent.handCount !== 'number') {
      throw new Error(`${context}: opponent is missing handCount`);
    }
  }
}
