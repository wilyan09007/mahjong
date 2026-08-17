/**
 * The app's single source of truth.
 *
 * WRITTEN BY SERVER MESSAGES ONLY. No screen mutates game state locally; the
 * one concession to responsiveness is `pendingAction`, which disables inputs
 * while an action is in flight and clears on the next `view`. That rule is what
 * makes the client impossible to desynchronise: if the server rejects
 * something, it re-sends the truth and the store simply overwrites.
 *
 * `applyServerMessage` is a pure reducer over the store's shape, so the whole
 * message-handling surface is testable without a socket.
 */

import { create } from 'zustand';
import type {
  EmoteBroadcast, ErrorMessage, HandResultMessage, LobbyMessage, PlayerView,
  Seat, SeatStatusMessage, SessionEndMessage,
} from '../net/messages.js';
import { S2C } from '../net/messages.js';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface EmoteBubble { seat: Seat; emote: string; id: number }

/** The part of the store that server messages own. */
export interface ServerState {
  lobby: LobbyMessage | null;
  view: PlayerView | null;
  seatStatus: Record<number, boolean>;
  lastHandResult: HandResultMessage | null;
  standings: SessionEndMessage['standings'] | null;
  emotes: EmoteBubble[];
  errorMessage: string | null;
  pendingAction: boolean;
}

export const EMPTY_SERVER_STATE: ServerState = {
  lobby: null,
  view: null,
  seatStatus: {},
  lastHandResult: null,
  standings: null,
  emotes: [],
  errorMessage: null,
  pendingAction: false,
};

/** Keep the last few emote bubbles; older ones have already floated away. */
export const MAX_EMOTES = 5;

let emoteSequence = 0;

/**
 * The reducer. Pure: same state + same message ⇒ same result, no side effects.
 */
export function applyServerMessage(
  state: ServerState,
  type: string,
  payload: unknown,
): ServerState {
  switch (type) {
    case S2C.lobby:
      return { ...state, lobby: payload as LobbyMessage, errorMessage: null };

    case S2C.view:
      // A view is the authoritative picture, so it always clears the in-flight
      // flag — including when it arrived because the server REJECTED our action
      // and re-sent the truth.
      return { ...state, view: payload as PlayerView, pendingAction: false };

    case S2C.handResult:
      return { ...state, lastHandResult: payload as HandResultMessage };

    case S2C.seatStatus: {
      const { seat, connected } = payload as SeatStatusMessage;
      return { ...state, seatStatus: { ...state.seatStatus, [seat]: connected } };
    }

    case S2C.sessionEnd:
      return { ...state, standings: (payload as SessionEndMessage).standings };

    case S2C.error:
      // An error must NOT clobber the view — the position is still valid, the
      // last thing we tried simply was not. Clearing pendingAction lets the
      // player try something else immediately.
      return {
        ...state,
        errorMessage: (payload as ErrorMessage).message,
        pendingAction: false,
      };

    case S2C.emote: {
      const { seat, emote } = payload as EmoteBroadcast;
      const bubble: EmoteBubble = { seat, emote, id: ++emoteSequence };
      return { ...state, emotes: [...state.emotes, bubble].slice(-MAX_EMOTES) };
    }

    default:
      return state;
  }
}

export interface GameStore extends ServerState {
  connection: ConnectionState;
  identity: { playerId: string; name: string } | null;

  setConnection(connection: ConnectionState, errorMessage?: string): void;
  setIdentity(identity: { playerId: string; name: string }): void;
  onMessage(type: string, payload: unknown): void;
  markActionPending(): void;
  dismissError(): void;
  clearHandResult(): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  ...EMPTY_SERVER_STATE,
  connection: 'idle',
  identity: null,

  setConnection: (connection, errorMessage) =>
    set((s) => ({ connection, errorMessage: errorMessage ?? s.errorMessage })),

  setIdentity: (identity) => set({ identity }),

  onMessage: (type, payload) => set((s) => applyServerMessage(s, type, payload)),

  markActionPending: () => set({ pendingAction: true }),

  dismissError: () => set({ errorMessage: null }),

  clearHandResult: () => set({ lastHandResult: null }),

  reset: () => set({ ...EMPTY_SERVER_STATE, connection: 'idle' }),
}));
