/**
 * The colyseus.js wrapper.
 *
 * Deliberately thin: it owns the socket and nothing else. Every message is
 * funnelled straight into the store's reducer, so all the interesting logic
 * stays in a pure function that tests can drive without a network.
 */

import { Client, ErrorCode, type Room } from 'colyseus.js';
import { C2S, JOIN_ERROR, S2C, type Action } from './messages.js';
import { useGameStore } from '../state/store.js';

/**
 * Android emulators reach the host machine at 10.0.2.2, not localhost —
 * localhost inside the emulator is the emulator. On a physical device set
 * EXPO_PUBLIC_SERVER_URL to the machine's LAN IP.
 */
export const SERVER_URL =
  process.env['EXPO_PUBLIC_SERVER_URL'] ?? 'http://10.0.2.2:2567';

/** Every server→client message we listen for. */
const SUBSCRIBED = Object.values(S2C);

let room: Room | null = null;
let reconnectAttempts = 0;
let lastJoin: { code: string; playerId: string; name: string } | null = null;

function attach(joined: Room): void {
  room = joined;
  reconnectAttempts = 0;

  for (const type of SUBSCRIBED) {
    joined.onMessage(type, (payload: unknown) => {
      useGameStore.getState().onMessage(type, payload);
    });
  }

  joined.onLeave((code: number) => {
    room = null;
    // 1000 is a clean, intentional close — anything else dropped on us.
    if (code === 1000) {
      useGameStore.getState().setConnection('idle');
      return;
    }
    useGameStore.getState().setConnection('error');
    void attemptRejoin();
  });
}

/**
 * The server restores seats by playerId, so rejoining IS reconnection — there
 * is no separate session token to keep alive. Three tries with backoff, then
 * we stop and let the player decide.
 */
async function attemptRejoin(): Promise<void> {
  if (!lastJoin || reconnectAttempts >= 3) return;
  reconnectAttempts += 1;
  const delay = 500 * 2 ** (reconnectAttempts - 1);
  await new Promise((resolve) => setTimeout(resolve, delay));
  try {
    useGameStore.getState().setConnection('connecting');
    const client = new Client(SERVER_URL);
    attach(await client.joinById(lastJoin.code, {
      playerId: lastJoin.playerId,
      name: lastJoin.name,
    }));
    useGameStore.getState().setConnection('connected');
  } catch {
    useGameStore.getState().setConnection('error');
    void attemptRejoin();
  }
}

export async function createRoom(playerId: string, name: string): Promise<string> {
  const store = useGameStore.getState();
  store.setConnection('connecting');
  try {
    const client = new Client(SERVER_URL);
    const joined = await client.create('table', { playerId, name });
    lastJoin = { code: joined.roomId, playerId, name };
    attach(joined);
    store.setConnection('connected');
    return joined.roomId;
  } catch (error) {
    store.setConnection('error', describe(error));
    throw error;
  }
}

export async function joinRoom(code: string, playerId: string, name: string): Promise<void> {
  const store = useGameStore.getState();
  store.setConnection('connecting');
  try {
    const client = new Client(SERVER_URL);
    const joined = await client.joinById(code, { playerId, name });
    lastJoin = { code, playerId, name };
    attach(joined);
    store.setConnection('connected');
  } catch (error) {
    store.setConnection('error', describe(error));
    throw error;
  }
}

export function send(type: string, payload: unknown): void {
  room?.send(type, payload);
}

export function playAction(action: Action): void {
  if (!room) return;
  // Disable inputs until the next view arrives, so a double-tap cannot send the
  // same discard twice.
  useGameStore.getState().markActionPending();
  room.send(C2S.action, { action });
}

export async function leaveRoom(): Promise<void> {
  lastJoin = null;
  reconnectAttempts = 0;
  await room?.leave();
  room = null;
  useGameStore.getState().reset();
}

export function currentRoomCode(): string | null {
  return room?.roomId ?? null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Why a join was refused, in the terms the player needs to hear. */
export type JoinFailure = 'no-such-table' | 'table-full' | 'unreachable';

/**
 * Classify a rejected join.
 *
 * Worth the trouble because the three cases need opposite responses: check the
 * code with your friend, wait for a seat, or check your wifi. Reporting all of
 * them as "could not reach the table" — which is what the first version did —
 * sends someone to their network settings when they actually mistyped a
 * character off a photo of someone's screen.
 *
 * Codes verified against a real server in `packages/server/test/lobby.test.ts`.
 * Note that a table full of four HUMANS is genuinely indistinguishable from an
 * unknown code: `maxClients` locks the room and matchmaking refuses locked
 * rooms by id before the room's own code runs. So `no-such-table` has to be
 * worded to cover "that table is closed" as well as "no such code".
 */
export function classifyJoinFailure(error: unknown): JoinFailure {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (code === JOIN_ERROR.tableFull) return 'table-full';
  if (
    code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID
    || code === ErrorCode.MATCHMAKE_EXPIRED
    || code === ErrorCode.MATCHMAKE_NO_HANDLER
  ) {
    return 'no-such-table';
  }
  return 'unreachable';
}
