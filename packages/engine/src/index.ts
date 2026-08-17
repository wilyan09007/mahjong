/**
 * `@mahjong/engine` public API.
 *
 * The whole engine is three functions — `newHand`, `legalActions`,
 * `applyAction` — plus the types they speak in. Everything a server or bot
 * needs is exported here, and `test/simulation.test.ts` imports from this file
 * ONLY, which is how we know this surface is enough to play complete games.
 *
 * SECURITY NOTE FOR CONSUMERS: `GameState` contains all hidden information.
 * A server must never send `tiles`, `wallFront`, `wallBack`, or another
 * player's `hand` to a client. See README.md.
 */

export const ENGINE_VERSION = '0.1.0';

// Tiles — the vocabulary everything else speaks.
export {
  SUIT_KINDS, WINDS, DRAGONS, FLOWERS, NON_FLOWER_KINDS, FULL_TILE_SET,
  isFlower, isSuitTile, isHonor, rankOf, suitOf, sortTiles, kindIndex, seatWind,
} from './tiles.js';
export type {
  SuitCode, Rank, SuitTileKind, WindKind, DragonKind, HonorKind, FlowerKind,
  TileKind, Seat, Wind,
} from './tiles.js';

// Wall — the engine's only randomness.
export { mulberry32, buildWall } from './wall.js';

// Melds.
export {
  chowOptions, canPung, canExposedKong, concealedKongOptions, addedKongOptions,
} from './melds.js';
export type { MeldType, Meld } from './melds.js';

// Win detection.
export { isWinningHand, decomposeWin, decomposeWinAll, winningTiles } from './win.js';
export type { WinDecomposition } from './win.js';

// Dealing.
export { dealHands } from './deal.js';
export type { DealResult } from './deal.js';

// The state machine.
export {
  IllegalActionError, DEFAULT_RULES, WALL_FLOOR, newHand, legalActions, applyAction,
} from './game.js';
export type {
  Phase, PlayerState, HandRules, GameState, HandResult, Action,
  ClaimAction, ClaimKind, ClaimOption, PendingClaims,
} from './game.js';

// Claims.
export { computeClaimOptions, eligibleSeats, resolveClaims } from './claims.js';

// The security boundary — the only thing a server may send a client.
export { viewFor } from './view.js';
export type { PlayerView, OpponentView } from './view.js';

// Scoring.
export { scoreTaiwaneseHand } from './scoring/taiwanese.js';
export type { TaiItem, ScoreContext } from './scoring/taiwanese.js';
export { computePayments } from './scoring/payments.js';

// Debugging. Pure renderers — nothing here prints; the caller decides where
// verbose output goes, which is how the engine stays I/O-free.
export {
  formatTile, formatTiles, formatMeld, formatAction, formatResult,
  formatPlayer, formatState, formatLegalActions, traceAction, traceHand,
} from './debug.js';
export { checkInvariants, assertInvariants, EngineInvariantError } from './invariants.js';

// Session and variants.
export { nextHandParams, newSession, isSessionOver } from './session.js';
export type { SessionParams } from './session.js';
export { TAIWANESE, VARIANTS, resolveVariant } from './variant.js';
export type { Variant, VariantId } from './variant.js';
