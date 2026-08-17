/**
 * The core state machine.
 *
 * Three functions are the whole public contract:
 *   newHand(args)            → GameState
 *   legalActions(state, seat) → Action[]
 *   applyAction(state, action) → GameState
 *
 * `applyAction` never mutates its input — it structuredClones a draft and
 * returns that — and it throws `IllegalActionError` rather than ignoring an
 * action it cannot perform. A server can therefore hand it untrusted client
 * input directly and trust the outcome.
 *
 * This file grows across Tasks 6-11 of Plan 1. Right now it holds the state
 * shape and the opening deal.
 */

import { dealHands } from './deal.js';
import { buildWall } from './wall.js';
import type { Meld } from './melds.js';
import type { FlowerKind, Seat, TileKind, Wind } from './tiles.js';

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
  result: HandResult | null;
}

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
    result: null,
  };
}
