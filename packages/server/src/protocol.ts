/**
 * The wire protocol, in one place.
 *
 * Plan 3's Expo client is written against these names and shapes, so this file
 * is a contract, not an implementation detail. Renaming anything here breaks
 * the app.
 *
 * THE INVARIANT THAT MATTERS: the only game data that ever reaches a client is
 * a `PlayerView`. Never `GameState`, never `tiles`, never `wallFront`/
 * `wallBack`, never another player's `hand`. Every server→client message below
 * either carries a `PlayerView` or carries no hidden information at all.
 */

import type { HandResult, PlayerView, Seat } from '@mahjong/engine';
import type { Action } from '@mahjong/engine';

export type SeatKind = 'human' | 'bot' | 'empty';

/** A seat as everyone is allowed to see it. No playerId — that is private. */
export interface SeatPublic {
  seat: Seat;
  kind: SeatKind;
  name: string | null;
  connected: boolean;
}

export interface RoomConfig {
  /** 1, 2 or 4 laps of the deal. 4 is 全莊, the full Taiwanese game. */
  totalRounds: 1 | 2 | 4;
  /** 底 — the flat stake on every payment. */
  base: number;
  /** 台 — points per tai. */
  perTai: number;
  turnSeconds: number;
  claimSeconds: number;
  botDelayMs: number;
  interHandMs: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  totalRounds: 1,
  base: 3,
  perTai: 1,
  turnSeconds: 30,
  claimSeconds: 7,
  botDelayMs: 700,
  interHandMs: 5000,
};

// ---------------------------------------------------------------------------
// client → server
// ---------------------------------------------------------------------------

export interface JoinOptions {
  playerId: string;
  name: string;
  /**
   * Timing overrides so tests do not wait real seconds. Honoured ONLY when
   * NODE_ENV === 'test'; in production the field is ignored entirely, so a
   * client cannot shorten its own turn timer.
   */
  __test?: Partial<Pick<RoomConfig, 'turnSeconds' | 'claimSeconds' | 'botDelayMs' | 'interHandMs'>>;
}

export type ConfigMessage = Partial<
  Pick<RoomConfig, 'totalRounds' | 'base' | 'perTai' | 'turnSeconds' | 'claimSeconds'>
>;
export interface SeatMessage { seat: Seat }
export interface ActionMessage { action: Action }
export interface EmoteMessage { emote: string }

// ---------------------------------------------------------------------------
// server → client
// ---------------------------------------------------------------------------

export interface LobbyMessage {
  code: string;
  hostPlayerId: string | null;
  config: RoomConfig;
  seats: SeatPublic[];
}

export interface HandResultMessage {
  result: HandResult;
  /** Running session totals, in seat order. */
  scores: [number, number, number, number];
}

export interface SeatStatusMessage {
  seat: Seat;
  connected: boolean;
}

export interface SessionEndMessage {
  standings: { seat: Seat; name: string; score: number }[];
}

export interface ErrorMessage { message: string }
export interface EmoteBroadcast { seat: Seat; emote: string }

/** Server→client message names, so both sides spell them the same way. */
export const S2C = {
  lobby: 'lobby',
  view: 'view',
  handResult: 'hand-result',
  seatStatus: 'seat-status',
  sessionEnd: 'session-end',
  error: 'error',
  emote: 'emote',
} as const;

/**
 * Codes carried on a rejected join, as `ServerError.code` on the client.
 *
 * The client shows a different message for each, so it must not have to
 * string-match the English prose — that breaks the first time these are
 * localised. Colyseus reserves 4210–4216 for its own matchmaking errors, so
 * these sit well clear of that range.
 *
 * Note what is NOT here: a table full of four HUMANS cannot be reported this
 * way. `maxClients` locks the room and matchmaking refuses locked rooms by id
 * before `onJoin` ever runs, so the client sees MATCHMAKE_INVALID_ROOM_ID and
 * cannot tell it from a mistyped code. Bots are not clients, so a bot-filled
 * table does reach `onJoin` and does get this code.
 */
export const JOIN_ERROR = {
  /** Every seat is taken. Reachable when bots hold the seats. */
  tableFull: 4400,
  /** No playerId, so no seat can be assigned or restored. A client bug. */
  missingPlayerId: 4401,
} as const;

/** Client→server message names. */
export const C2S = {
  config: 'config',
  fillBot: 'fill-bot',
  removeBot: 'remove-bot',
  start: 'start',
  action: 'action',
  emote: 'emote',
} as const;

export type { PlayerView, Action, HandResult };
