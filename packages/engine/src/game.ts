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
import {
  addedKongOptions, chowOptions, concealedKongOptions, type Meld,
} from './melds.js';
import {
  computeClaimOptions, eligibleSeats, resolveClaims,
  type ClaimOption, type PendingClaims,
} from './claims.js';
import { isWinningHand } from './win.js';
import { isFlower, sortTiles, type FlowerKind, type Seat, type TileKind, type Wind } from './tiles.js';

export type { ClaimAction, ClaimKind, ClaimOption, PendingClaims } from './claims.js';

/** Thrown for any action the rules do not permit. Never swallowed. */
export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export type Phase = 'awaiting-discard' | 'awaiting-claims' | 'finished';

// Compile-time seam filled in by Task 10 (scoring). It exists now so the file
// typechecks; every use site is named in the plan.
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
  /**
   * An added kong waiting on its 搶槓 window. The 4th tile is still in the
   * declarer's hand while the window is open — it only moves onto the meld if
   * nobody robs. Keeping it in hand is what makes tile conservation hold at
   * every intermediate step, including mid-window.
   */
  pendingKong: { seat: Seat; tile: TileKind } | null;
  /** 搶槓 — this hand was won by robbing an added kong. */
  wasKongRob: boolean;
  /** 海底撈月 — the last drawable tile has been taken. */
  wasLastTile: boolean;
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
    pendingKong: null,
    wasKongRob: false,
    wasLastTile: false,
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
  // 海底撈月: nothing is drawable after this one.
  if (wallRemaining(s) <= WALL_FLOOR) s.wasLastTile = true;
  return true;
}

/**
 * Draw a replacement from the BACK of the wall (the dead wall) after a kong.
 * Flowers found there are exposed and the draw repeats. Returns false at the
 * wall floor, which ends the hand.
 */
function drawReplacementFor(s: GameState, seat: Seat): boolean {
  for (;;) {
    if (wallRemaining(s) <= WALL_FLOOR) return false;
    const tile = s.tiles[s.wallBack--]!;
    if (isFlower(tile)) {
      s.players[seat].flowers.push(tile);
      continue;
    }
    s.players[seat].hand = sortTiles([...s.players[seat].hand, tile]);
    s.lastDrawWasReplacement = true;
    s.drewThisTurn = true;
    if (wallRemaining(s) <= WALL_FLOOR) s.wasLastTile = true;
    return true;
  }
}

/**
 * Move the 4th tile out of the declarer's hand and onto its exposed pung, then
 * take a dead-wall replacement. Called either straight away (nobody could rob)
 * or after the 搶槓 window closes with everyone passing.
 */
function completePendingKong(s: GameState): void {
  const pk = s.pendingKong;
  if (!pk) {
    throw new IllegalActionError('no added kong is pending');
  }
  s.pendingKong = null;
  spendFromHand(s, pk.seat, [pk.tile]);
  const meld = s.players[pk.seat].melds.find(
    (m) => m.type === 'pung' && m.tiles[0] === pk.tile,
  );
  if (!meld) {
    throw new IllegalActionError(
      `seat ${pk.seat} has no exposed pung of ${pk.tile} to upgrade`,
    );
  }
  meld.type = 'kong';
  meld.tiles = [pk.tile, pk.tile, pk.tile, pk.tile];
  s.turn = pk.seat;
  s.phase = 'awaiting-discard';
  if (!drawReplacementFor(s, pk.seat)) endExhaustive(s);
}

function endExhaustive(s: GameState): void {
  s.phase = 'finished';
  s.result = null; // wired to a real draw result in Task 10
  s.pendingClaims = null;
}

/** Nobody took the discard: the seat to the discarder's left draws and plays. */
function advanceAfterDiscard(s: GameState, discarder: Seat): void {
  const next = ((discarder + 1) % 4) as Seat;
  s.turn = next;
  s.phase = 'awaiting-discard';
  s.drewThisTurn = false;
  if (!drawFor(s, next)) endExhaustive(s);
}

/** Remove exactly these tiles from a hand, or throw naming the one that is missing. */
function spendFromHand(s: GameState, seat: Seat, tiles: TileKind[]): void {
  const hand = s.players[seat].hand;
  for (const t of tiles) {
    const i = hand.indexOf(t);
    if (i === -1) {
      throw new IllegalActionError(
        `seat ${seat} cannot spend ${t}: not in hand (hand: ${hand.join(' ')})`,
      );
    }
    hand.splice(i, 1);
  }
}

/**
 * Everyone eligible has answered — award the tile and hand back control.
 *
 * Claim execution is centralised here (rather than inlined per action) because
 * all three win paths and both meld paths must agree on the same bookkeeping:
 * the tile leaves the pond exactly once, and `turn` always ends up on whoever
 * is next to act.
 */
function resolvePendingClaims(s: GameState): void {
  const pc = s.pendingClaims!;
  const winning = resolveClaims(pc);
  s.pendingClaims = null;

  if (winning === null) {
    if (pc.source === 'kong-rob') completePendingKong(s);
    else advanceAfterDiscard(s, pc.from);
    return;
  }

  const seat = winning.seat;
  const tile = pc.tile;

  if (pc.source === 'kong-rob') {
    // 搶槓. The 4th tile never reached the meld, so it comes straight out of
    // the declarer's hand; their meld stays the pung it was.
    spendFromHand(s, pc.from, [tile]);
    s.pendingKong = null;
    s.wasKongRob = true;
    s.players[seat].hand = sortTiles([...s.players[seat].hand, tile]);
    s.turn = seat;
    s.phase = 'finished';
    s.result = null; // scored in Task 10
    return;
  }

  // The claimed tile leaves the discarder's pond — it was never really theirs.
  const discards = s.players[pc.from].discards;
  const di = discards.lastIndexOf(tile);
  if (di === -1) {
    throw new IllegalActionError(
      `claimed tile ${tile} is not in seat ${pc.from}'s discards ` +
        `(${discards.join(' ') || 'empty'})`,
    );
  }
  discards.splice(di, 1);
  s.lastDiscard = null;

  if (winning.claim === 'win') {
    s.players[seat].hand = sortTiles([...s.players[seat].hand, tile]);
    s.turn = seat;
    s.phase = 'finished';
    s.result = null; // scored in Task 10
    return;
  }

  switch (winning.claim) {
    case 'chow': {
      const [a, b] = winning.chowTiles!;
      spendFromHand(s, seat, [a, b]);
      s.players[seat].melds.push({
        type: 'chow', tiles: sortTiles([a, b, tile]), concealed: false, claimedFrom: pc.from,
      });
      break;
    }
    case 'pung': {
      spendFromHand(s, seat, [tile, tile]);
      s.players[seat].melds.push({
        type: 'pung', tiles: [tile, tile, tile], concealed: false, claimedFrom: pc.from,
      });
      break;
    }
    case 'kong': {
      spendFromHand(s, seat, [tile, tile, tile]);
      s.players[seat].melds.push({
        type: 'kong', tiles: [tile, tile, tile, tile], concealed: false, claimedFrom: pc.from,
      });
      break;
    }
  }

  s.turn = seat;
  s.phase = 'awaiting-discard';
  if (winning.claim === 'kong') {
    // A kong claimer takes a replacement and discards from 17 again.
    if (!drawReplacementFor(s, seat)) endExhaustive(s);
  } else {
    // Chow and pung take no tile from the wall, so the claimer has not drawn:
    // `self-win` stays blocked and 槓上開花 does not apply.
    s.drewThisTurn = false;
    s.lastDrawWasReplacement = false;
  }
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

      // Anyone who can take this tile gets the chance before play moves on.
      const options = computeClaimOptions(s);
      if (options.length > 0) {
        s.phase = 'awaiting-claims';
        s.pendingClaims = {
          tile: action.tile,
          from: action.seat,
          source: 'discard',
          options,
          responses: {},
        };
        return s;
      }
      advanceAfterDiscard(s, action.seat);
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
    case 'claim':
    case 'pass': {
      if (s.phase !== 'awaiting-claims' || !s.pendingClaims) {
        reject(s, action, 'no claim window is open');
      }
      const pc = s.pendingClaims;
      const seats = eligibleSeats(pc);
      if (!seats.includes(action.seat)) {
        reject(
          s,
          action,
          `seat ${action.seat} has no claim on ${pc.tile} ` +
            `(eligible seats: ${seats.join(', ') || 'none'})`,
        );
      }
      if (pc.responses[action.seat] !== undefined) {
        reject(s, action, `seat ${action.seat} has already responded to this window`);
      }
      if (action.type === 'claim') {
        const entitled = pc.options.some(
          (o) => o.seat === action.seat && o.claim === action.claim,
        );
        if (!entitled) {
          const mine = pc.options.filter((o) => o.seat === action.seat).map((o) => o.claim);
          reject(
            s,
            action,
            `seat ${action.seat} cannot ${action.claim} ${pc.tile} ` +
              `(available: ${mine.join(', ') || 'none'})`,
          );
        }
        if (action.claim === 'chow') {
          const pair = action.chowTiles;
          if (!pair) {
            reject(s, action, `a chow claim must name its chowTiles`);
          }
          const legal = chowOptions(s.players[action.seat].hand, pc.tile)
            .some(([a, b]) => a === pair[0] && b === pair[1]);
          if (!legal) {
            reject(
              s,
              action,
              `${pair.join('+')} is not a legal chow for ${pc.tile} ` +
                `(hand: ${s.players[action.seat].hand.join(' ')})`,
            );
          }
        }
      }

      pc.responses[action.seat] = action;
      if (seats.every((x) => pc.responses[x] !== undefined)) {
        resolvePendingClaims(s);
      }
      return s;
    }
    case 'concealed-kong': {
      if (s.phase !== 'awaiting-discard' || action.seat !== s.turn) {
        reject(s, action, 'a concealed kong may only be declared on your own turn');
      }
      const hand = s.players[action.seat].hand;
      if (!concealedKongOptions(hand).includes(action.tile)) {
        reject(
          s,
          action,
          `seat ${action.seat} does not hold four ${action.tile} ` +
            `(hand: ${hand.join(' ')})`,
        );
      }
      spendFromHand(s, action.seat, [action.tile, action.tile, action.tile, action.tile]);
      s.players[action.seat].melds.push({
        type: 'kong',
        tiles: [action.tile, action.tile, action.tile, action.tile],
        concealed: true,
        claimedFrom: null,
      });
      // A concealed kong cannot be robbed; take the replacement and play on.
      if (!drawReplacementFor(s, action.seat)) endExhaustive(s);
      return s;
    }
    case 'added-kong': {
      if (s.phase !== 'awaiting-discard' || action.seat !== s.turn) {
        reject(s, action, 'an added kong may only be declared on your own turn');
      }
      const p = s.players[action.seat];
      if (!addedKongOptions(p.hand, p.melds).includes(action.tile)) {
        reject(
          s,
          action,
          `seat ${action.seat} cannot add ${action.tile} to an exposed pung ` +
            `(hand: ${p.hand.join(' ')}; melds: ${p.melds.map((m) => m.tiles.join('')).join(' ')})`,
        );
      }
      s.pendingKong = { seat: action.seat, tile: action.tile };

      // 搶槓: an added kong is the one meld that can be stolen mid-declaration,
      // and only by a seat that wins outright on that tile.
      const robbers: ClaimOption[] = [];
      for (let i = 1; i < 4; i++) {
        const seat = ((action.seat + i) % 4) as Seat;
        if (isWinningHand([...s.players[seat].hand, action.tile])) {
          robbers.push({ seat, claim: 'win' });
        }
      }
      if (robbers.length > 0) {
        s.phase = 'awaiting-claims';
        s.pendingClaims = {
          tile: action.tile,
          from: action.seat,
          source: 'kong-rob',
          options: robbers,
          responses: {},
        };
        return s;
      }
      completePendingKong(s);
      return s;
    }
    default:
      reject(s, action, `unsupported action`);
  }
}

export function legalActions(state: GameState, seat: Seat): Action[] {
  if (state.phase === 'awaiting-claims') {
    const pc = state.pendingClaims;
    if (!pc) return [];
    // A seat that already answered is done; the window is waiting on others.
    if (pc.responses[seat] !== undefined) return [];
    const mine = pc.options.filter((o) => o.seat === seat);
    if (mine.length === 0) return [];
    const actions: Action[] = [];
    for (const option of mine) {
      if (option.claim === 'chow') {
        // One action per distinct run the hand can build, so a caller never has
        // to guess which two tiles to spend.
        for (const [a, b] of chowOptions(state.players[seat].hand, pc.tile)) {
          actions.push({ type: 'claim', seat, claim: 'chow', chowTiles: [a, b] });
        }
      } else {
        actions.push({ type: 'claim', seat, claim: option.claim });
      }
    }
    actions.push({ type: 'pass', seat });
    return actions;
  }

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
