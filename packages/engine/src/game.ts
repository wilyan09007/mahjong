/**
 * The core state machine.
 *
 * Three functions are the whole public contract:
 *   newHand(args)             → GameState
 *   legalActions(state, seat) → Action[]
 *   applyAction(state, action) → GameState
 *
 * `applyAction` never mutates its input — it structuredClones a draft and
 * returns that — and it throws `IllegalActionError` rather than ignoring an
 * action it cannot perform. A server can therefore hand it untrusted client
 * input directly and trust the outcome.
 *
 * Every rejection message names the seat, the action, the phase and whose turn
 * it actually is. When this engine says no, it says why, because the caller
 * (a server, a bot, a test) has no other way to see inside a pure function.
 *
 * This file grows across Tasks 6-11 of Plan 1. Right now it holds the state
 * shape, the opening deal, and turn flow: discard → auto-draw → flowers →
 * self-win → exhaustive draw.
 */

import { dealHands } from './deal.js';
import { buildWall } from './wall.js';
import { addedKongOptions, concealedKongOptions, type Meld } from './melds.js';
import { isWinningHand } from './win.js';
import { isFlower, sortTiles, type FlowerKind, type Seat, type TileKind, type Wind } from './tiles.js';

/** Thrown for any action the rules do not permit. Never swallowed. */
export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export type Phase = 'awaiting-discard' | 'awaiting-claims' | 'finished';

// Compile-time seams filled in by Task 8 (claims) and Task 10 (scoring). They
// exist now so the file typechecks; every use site is named in the plan.
export type PendingClaims = never;
export type HandResult = never;

export interface PlayerState {
  /** Concealed tiles, always kept sorted. Never contains a flower. */
  hand: TileKind[];
  melds: Meld[];
  flowers: FlowerKind[];
  discards: TileKind[];
}

/** House stakes. 底 = base, 台 = per-tai. Parameters, never hardcoded. */
export interface HandRules {
  base: number;
  perTai: number;
}

export const DEFAULT_RULES: HandRules = { base: 3, perTai: 1 };

/**
 * The hand ends in an exhaustive draw when the live wall is down to this many
 * tiles. Those 16 are the dead wall's remainder and are never drawn.
 */
export const WALL_FLOOR = 16;

export interface GameState {
  seed: number;
  /** The fixed shuffled 144. Never mutated — draws move the indexes below. */
  tiles: TileKind[];
  /** Next index to draw from the front (normal draws). */
  wallFront: number;
  /** Next index to draw from the back (flower and kong replacements). */
  wallBack: number;
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  rules: HandRules;
  turn: Seat;
  phase: Phase;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  lastDiscard: { tile: TileKind; by: Seat } | null;
  pendingClaims: PendingClaims | null;
  /** 槓上開花 — the tile in hand came from the dead wall, not the front. */
  lastDrawWasReplacement: boolean;
  /**
   * True when the seat on turn got here by drawing (wall or replacement),
   * false when it got here by claiming a chow or pung.
   *
   * This gates `self-win`. Without it a player who claimed a chow into a
   * winning shape could "self-draw" a win they never drew, collecting 自摸
   * (and 門清自摸加台) they did not earn. The claim window already offers
   * `win` for that tile at higher priority, so nothing legitimate is lost.
   */
  drewThisTurn: boolean;
  result: HandResult | null;
}

export type Action =
  | { type: 'discard'; seat: Seat; tile: TileKind }
  | { type: 'self-win'; seat: Seat }
  | { type: 'concealed-kong'; seat: Seat; tile: TileKind }
  | { type: 'added-kong'; seat: Seat; tile: TileKind }
  | {
      type: 'claim';
      seat: Seat;
      claim: 'chow' | 'pung' | 'kong' | 'win';
      chowTiles?: [TileKind, TileKind];
    }
  | { type: 'pass'; seat: Seat };

export function newHand(args: {
  seed: number;
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  rules?: HandRules;
}): GameState {
  const tiles = buildWall(args.seed);
  const { hands, flowers, wallFront, wallBack } = dealHands(tiles, args.dealer);
  const players = ([0, 1, 2, 3] as const).map((s) => ({
    hand: hands[s]!,
    melds: [] as Meld[],
    flowers: flowers[s]!,
    discards: [] as TileKind[],
  })) as GameState['players'];

  return {
    seed: args.seed,
    tiles,
    wallFront,
    wallBack,
    dealer: args.dealer,
    dealerStreak: args.dealerStreak,
    roundWind: args.roundWind,
    rules: args.rules ?? DEFAULT_RULES,
    turn: args.dealer,
    phase: 'awaiting-discard',
    players,
    lastDiscard: null,
    pendingClaims: null,
    lastDrawWasReplacement: false,
    // The dealer's 17th tile is their opening draw, so a dealt winning hand is
    // a legitimate self-draw win (天胡).
    drewThisTurn: true,
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clone(state: GameState): GameState {
  return structuredClone(state);
}

/** Tiles still drawable, counting both ends. Front and back share one array. */
function wallRemaining(s: GameState): number {
  return s.wallBack - s.wallFront + 1;
}

/** Short state summary attached to every rejection so failures are readable. */
function where(s: GameState): string {
  return `phase=${s.phase} turn=seat ${s.turn} wall=${wallRemaining(s)}`;
}

function reject(s: GameState, action: Action, why: string): never {
  throw new IllegalActionError(`${why} [action=${action.type} seat ${action.seat}; ${where(s)}]`);
}

/**
 * Draw for `seat` from the front, auto-exposing and replacing flowers from the
 * back. Returns false when the wall floor was hit, meaning the hand ends in an
 * exhaustive draw. Mutates the draft.
 */
function drawFor(s: GameState, seat: Seat): boolean {
  if (wallRemaining(s) <= WALL_FLOOR) return false;
  let tile = s.tiles[s.wallFront++]!;
  s.lastDrawWasReplacement = false;
  while (isFlower(tile)) {
    s.players[seat].flowers.push(tile);
    if (wallRemaining(s) <= WALL_FLOOR) return false;
    tile = s.tiles[s.wallBack--]!;
    s.lastDrawWasReplacement = true;
  }
  s.players[seat].hand = sortTiles([...s.players[seat].hand, tile]);
  s.drewThisTurn = true;
  return true;
}

function endExhaustive(s: GameState): void {
  s.phase = 'finished';
  s.result = null; // wired to a real draw result in Task 10
  s.pendingClaims = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, action: Action): GameState {
  const s = clone(state);
  if (s.phase === 'finished') {
    reject(s, action, 'hand is finished');
  }
  switch (action.type) {
    case 'discard': {
      if (s.phase !== 'awaiting-discard') {
        reject(s, action, `cannot discard during ${s.phase}`);
      }
      if (action.seat !== s.turn) {
        reject(s, action, `not your discard: seat ${action.seat} played out of turn`);
      }
      const hand = s.players[action.seat].hand;
      const i = hand.indexOf(action.tile);
      if (i === -1) {
        reject(
          s,
          action,
          `tile not in hand: seat ${action.seat} does not hold ${action.tile} ` +
            `(hand: ${hand.join(' ')})`,
        );
      }
      hand.splice(i, 1);
      s.players[action.seat].discards.push(action.tile);
      s.lastDiscard = { tile: action.tile, by: action.seat };
      // Task 8 inserts the claim window here. For now: advance.
      const next = ((s.turn + 1) % 4) as Seat;
      s.turn = next;
      s.drewThisTurn = false;
      if (!drawFor(s, next)) endExhaustive(s);
      return s;
    }
    case 'self-win': {
      if (s.phase !== 'awaiting-discard' || action.seat !== s.turn) {
        reject(s, action, `not your turn to declare a win`);
      }
      if (!s.drewThisTurn) {
        reject(s, action, 'a self-draw win requires a tile drawn from the wall');
      }
      if (!isWinningHand(s.players[action.seat].hand)) {
        reject(
          s,
          action,
          `hand is not winning (hand: ${s.players[action.seat].hand.join(' ')})`,
        );
      }
      s.phase = 'finished';
      s.result = null; // scored in Task 10
      return s;
    }
    // 'concealed-kong' / 'added-kong': implemented in Task 9
    // 'claim' / 'pass': implemented in Task 8
    default:
      reject(s, action, `unsupported action`);
  }
}

export function legalActions(state: GameState, seat: Seat): Action[] {
  if (state.phase !== 'awaiting-discard' || seat !== state.turn) return [];
  const p = state.players[seat];
  const actions: Action[] = [...new Set(p.hand)].map((tile) => ({
    type: 'discard' as const,
    seat,
    tile,
  }));
  if (state.drewThisTurn && isWinningHand(p.hand)) {
    actions.push({ type: 'self-win', seat });
  }
  for (const tile of concealedKongOptions(p.hand)) {
    actions.push({ type: 'concealed-kong', seat, tile });
  }
  for (const tile of addedKongOptions(p.hand, p.melds)) {
    actions.push({ type: 'added-kong', seat, tile });
  }
  return actions;
}
