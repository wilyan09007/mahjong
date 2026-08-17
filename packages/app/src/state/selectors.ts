/**
 * Pure view-model derivations.
 *
 * Everything a screen needs to *decide* lives here rather than inside a
 * component, because these are the parts with real branching — which buttons
 * are legal, how a win reads, whether Start is allowed — and they are worth
 * testing without a renderer.
 */

import type { Action, HandResult, PlayerView, Seat, TileKind } from '@mahjong/engine';
import type { LobbyMessage, SeatPublic } from '../net/messages.js';
import { strings } from '../strings.js';

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export function canStart(
  lobby: LobbyMessage | null,
  myPlayerId: string | null,
): { ok: boolean; reason?: string } {
  if (!lobby) return { ok: false, reason: strings.connectFailed };
  if (!myPlayerId || lobby.hostPlayerId !== myPlayerId) {
    return { ok: false, reason: strings.waitingForHost };
  }
  if (lobby.seats.some((s) => s.kind === 'empty')) {
    return { ok: false, reason: strings.startNeedsFour };
  }
  return { ok: true };
}

export function seatLabel(seat: SeatPublic): string {
  if (seat.kind === 'empty') return strings.emptySeat;
  return seat.name ?? strings.emptySeat;
}

// ---------------------------------------------------------------------------
// Action bar
// ---------------------------------------------------------------------------

export interface ActionButton {
  label: string;
  action: Action;
  /** Distinguishes several chow options from one another in a list. */
  detail?: string;
}

export interface ActionBarModel {
  discard: Action | null;
  /** Needs a tile selected before Discard can fire. */
  needsSelection: boolean;
  claims: ActionButton[];
  win: ActionButton | null;
  pass: Action | null;
  kongs: ActionButton[];
}

/**
 * Turn `view.legalActions` into buttons.
 *
 * Chow is the interesting case: a hand can complete a run three different ways
 * and the engine offers one action per option, so each gets its own labelled
 * button rather than a single 吃 that silently guesses which tiles to spend.
 */
export function actionBarModel(
  view: PlayerView | null,
  selectedTile: TileKind | null,
): ActionBarModel {
  const empty: ActionBarModel = {
    discard: null, needsSelection: false, claims: [], win: null, pass: null, kongs: [],
  };
  if (!view || view.legalActions.length === 0) return empty;

  const model: ActionBarModel = { ...empty, claims: [], kongs: [] };

  for (const action of view.legalActions) {
    switch (action.type) {
      case 'discard':
        // One Discard button, driven by the current selection.
        model.needsSelection = true;
        if (selectedTile !== null && action.tile === selectedTile) model.discard = action;
        break;
      case 'self-win':
        model.win = { label: strings.win, action };
        break;
      case 'concealed-kong':
        model.kongs.push({ label: strings.kong, action, detail: action.tile });
        break;
      case 'added-kong':
        model.kongs.push({ label: strings.kong, action, detail: action.tile });
        break;
      case 'pass':
        model.pass = action;
        break;
      case 'claim':
        if (action.claim === 'win') {
          model.win = { label: strings.win, action };
        } else if (action.claim === 'chow') {
          model.claims.push({
            label: strings.chow,
            action,
            detail: action.chowTiles?.join(' ') ?? '',
          });
        } else if (action.claim === 'pung') {
          model.claims.push({ label: strings.pung, action });
        } else {
          model.claims.push({ label: strings.kong, action });
        }
        break;
    }
  }
  return model;
}

// ---------------------------------------------------------------------------
// Hand result
// ---------------------------------------------------------------------------

export interface ResultRow { name: string; tai: number }
export interface PaymentRow { name: string; delta: number; seat: Seat }

export interface FormattedResult {
  title: string;
  subtitle: string | null;
  rows: ResultRow[];
  total: number;
  payments: PaymentRow[];
  winningHand: { concealed: TileKind[]; melds: { tiles: TileKind[] }[] } | null;
}

/**
 * The Results overlay doubles as scoring education (per the spec), so the
 * breakdown is rendered line by line exactly as the engine scored it rather
 * than collapsed into one number.
 */
export function formatResult(
  result: HandResult,
  seatNames: Record<number, string>,
): FormattedResult {
  const nameOf = (seat: Seat): string => seatNames[seat] ?? `Seat ${seat + 1}`;

  if (result.type === 'draw-exhausted') {
    return {
      title: strings.exhaustiveDraw,
      subtitle: null,
      rows: [],
      total: 0,
      payments: [],
      winningHand: null,
    };
  }

  return {
    title: `${nameOf(result.winner)} — ${strings.tai(result.tai)}`,
    subtitle: result.by === 'self-draw'
      ? strings.selfDraw
      : strings.wonFrom(nameOf(result.discarder ?? result.winner)),
    rows: result.breakdown.map((b) => ({ name: b.name, tai: b.tai })),
    total: result.tai,
    payments: ([0, 1, 2, 3] as Seat[]).map((seat) => ({
      seat,
      name: nameOf(seat),
      delta: result.payments[seat],
    })),
    winningHand: {
      concealed: result.winningHand.concealed,
      melds: result.winningHand.melds.map((m) => ({ tiles: m.tiles })),
    },
  };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface Standing { seat: Seat; name: string; score: number; place: number }

/**
 * Rank by score, best first. Equal scores share a place — a table where two
 * players tie should not silently declare one of them the winner.
 */
export function rankStandings(
  entries: { seat: Seat; name: string; score: number }[],
): Standing[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.seat - b.seat);
  let place = 0;
  let previousScore: number | null = null;
  return sorted.map((entry, index) => {
    if (previousScore === null || entry.score !== previousScore) place = index + 1;
    previousScore = entry.score;
    return { ...entry, place };
  });
}

export const MEDALS = ['🥇', '🥈', '🥉'] as const;

export function medalFor(place: number): string {
  return MEDALS[place - 1] ?? `${place}`;
}
