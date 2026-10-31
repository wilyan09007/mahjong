/**
 * Pure view-model derivations.
 *
 * Everything a screen needs to *decide* lives here rather than inside a
 * component, because these are the parts with real branching — which buttons
 * are legal, how a win reads, whether Start is allowed — and they are worth
 * testing without a renderer.
 */

import { sortTiles, type Action, type HandResult, type PlayerView, type Seat, type TileKind } from '@mahjong/engine';
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
  /**
   * Tiles drawn on the button: a chow's whole run (its two tiles and the one
   * being claimed, in order), or the tile a kong is made of. Codes like
   * "2w 4w" are not something a player can read at a glance.
   */
  tiles?: TileKind[];
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
        model.kongs.push({ label: strings.kong, action, detail: action.tile, tiles: [action.tile] });
        break;
      case 'added-kong':
        model.kongs.push({ label: strings.kong, action, detail: action.tile, tiles: [action.tile] });
        break;
      case 'pass':
        model.pass = action;
        break;
      case 'claim':
        if (action.claim === 'win') {
          model.win = { label: strings.win, action };
        } else if (action.claim === 'chow') {
          const run = action.chowTiles && view.lastDiscard
            ? sortTiles([...action.chowTiles, view.lastDiscard.tile])
            : undefined;
          model.claims.push({
            label: strings.chow,
            action,
            detail: action.chowTiles?.join(' ') ?? '',
            tiles: run,
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

/** One button in the action row, in the order it is drawn left to right. */
export interface ActionButtonSpec {
  testID: string;
  label: string;
  tone: 'primary' | 'secondary';
  tiles: TileKind[];
  /** Null for Discard until a tile is selected: drawn, but not pressable. */
  action: Action | null;
}

/**
 * The action row, left to right. Pass sits at the far LEFT, away from the
 * thumb, so a hurried tap does not throw away a claim; 胡 and Discard sit at
 * the far right, under it.
 */
export function actionButtons(model: ActionBarModel): ActionButtonSpec[] {
  const out: ActionButtonSpec[] = [];
  if (model.pass) {
    out.push({ testID: 'action-pass', label: strings.pass, tone: 'secondary', tiles: [], action: model.pass });
  }
  model.claims.forEach((c, i) => out.push({
    testID: `action-claim-${i}`, label: c.label, tone: 'secondary', tiles: c.tiles ?? [], action: c.action,
  }));
  model.kongs.forEach((k, i) => out.push({
    testID: `action-kong-${i}`, label: k.label, tone: 'secondary', tiles: k.tiles ?? [], action: k.action,
  }));
  if (model.win) {
    out.push({ testID: 'action-win', label: model.win.label, tone: 'primary', tiles: [], action: model.win.action });
  }
  if (model.needsSelection) {
    out.push({ testID: 'action-discard', label: strings.discard, tone: 'primary', tiles: [], action: model.discard });
  }
  return out;
}

/**
 * Opponents to show as deciding, for the "thinking" dots by their names: the
 * player whose turn it is, and only them. Claim windows get no dots — they
 * last a moment, and dots on everyone who might claim read as noise.
 */
export function thinkingSeats(view: PlayerView): Seat[] {
  if (view.phase !== 'awaiting-discard') return [];
  return view.opponents.map((o) => o.seat).filter((s) => s === view.turn);
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
