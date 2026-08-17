/**
 * The client's copy of the wire protocol.
 *
 * Mirrors `packages/server/src/protocol.ts`, which is the authority — see
 * `packages/server/README.md`. It is duplicated rather than imported because
 * the app must not depend on the server package (it talks to it over a socket,
 * and bundling server code into a phone build would be wrong). Any change to
 * the server's protocol has to be reflected here; the shared vocabulary comes
 * from `@mahjong/engine`, which both sides genuinely do depend on.
 */

import type { Action, HandResult, PlayerView, Seat } from '@mahjong/engine';

export type SeatKind = 'human' | 'bot' | 'empty';

export interface SeatPublic {
  seat: Seat;
  kind: SeatKind;
  name: string | null;
  connected: boolean;
}

export interface RoomConfig {
  totalRounds: 1 | 2 | 4;
  base: number;
  perTai: number;
  turnSeconds: number;
  claimSeconds: number;
  botDelayMs: number;
  interHandMs: number;
}

export interface LobbyMessage {
  code: string;
  hostPlayerId: string | null;
  config: RoomConfig;
  seats: SeatPublic[];
}

export interface HandResultMessage {
  result: HandResult;
  scores: [number, number, number, number];
}

export interface SeatStatusMessage { seat: Seat; connected: boolean }
export interface SessionEndMessage {
  standings: { seat: Seat; name: string; score: number }[];
}
export interface ErrorMessage { message: string }
export interface EmoteBroadcast { seat: Seat; emote: string }

export const S2C = {
  lobby: 'lobby',
  view: 'view',
  handResult: 'hand-result',
  seatStatus: 'seat-status',
  sessionEnd: 'session-end',
  error: 'error',
  emote: 'emote',
} as const;

export const C2S = {
  config: 'config',
  fillBot: 'fill-bot',
  removeBot: 'remove-bot',
  start: 'start',
  action: 'action',
  emote: 'emote',
} as const;

export type { Action, HandResult, PlayerView, Seat };
