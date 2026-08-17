/**
 * The claim window.
 *
 * When a tile is discarded, the other three seats get a chance to take it. This
 * module answers two questions and nothing else:
 *
 *   computeClaimOptions — who *may* claim, and how?
 *   resolveClaims       — once everyone has answered, who *gets* it?
 *
 * Executing the winning claim (moving tiles, building the meld, handing over
 * the turn) is `game.ts`'s job.
 *
 * Priority is win > kong = pung > chow. Kong and pung share a rank because they
 * can never actually collide between two seats: a kong needs three copies in
 * one hand and a pung needs two, and 3 + 2 + the discarded one is five copies
 * of a four-copy tile. Only one seat can ever hold enough, and for that seat
 * kong-or-pung is a free choice, not a contest.
 */

import { canExposedKong, canPung, chowOptions } from './melds.js';
import { isWinningHand } from './win.js';
import type { Action, GameState } from './game.js';
import type { Seat, TileKind } from './tiles.js';

export type ClaimKind = 'win' | 'kong' | 'pung' | 'chow';

/** The `claim` arm of `Action`, narrowed so callers get `claim`/`chowTiles`. */
export type ClaimAction = Extract<Action, { type: 'claim' }>;

export interface ClaimOption {
  seat: Seat;
  claim: ClaimKind;
}

export interface PendingClaims {
  /** The tile under claim. */
  tile: TileKind;
  /** Seat the tile came from: the discarder, or the seat declaring an added kong. */
  from: Seat;
  /**
   * `'discard'` is the ordinary window. `'kong-rob'` is the win-only window
   * opened by an added kong (搶槓) — same machinery, but the only option
   * offered is `win`, and if everyone passes the kong completes instead of the
   * turn advancing. Task 9 uses it.
   */
  source: 'discard' | 'kong-rob';
  /** Every legal claim for this tile. Seats not listed here cannot respond. */
  options: ClaimOption[];
  /** One response per eligible seat; the window closes when all have answered. */
  responses: Partial<Record<Seat, Action>>;
}

const PRIORITY: Record<ClaimKind, number> = { win: 3, kong: 2, pung: 2, chow: 1 };

/**
 * Every legal claim on `state.lastDiscard`.
 *
 * Seats are walked in turn order starting one after the discarder, so `i === 1`
 * identifies the only seat allowed to chow (chow from the left player only) and
 * the discarder is never included at all.
 */
export function computeClaimOptions(state: GameState): ClaimOption[] {
  const d = state.lastDiscard;
  if (!d) return [];
  const options: ClaimOption[] = [];
  for (let i = 1; i < 4; i++) {
    const seat = ((d.by + i) % 4) as Seat;
    const hand = state.players[seat].hand;
    if (isWinningHand([...hand, d.tile])) options.push({ seat, claim: 'win' });
    if (canExposedKong(hand, d.tile)) options.push({ seat, claim: 'kong' });
    if (canPung(hand, d.tile)) options.push({ seat, claim: 'pung' });
    if (i === 1 && chowOptions(hand, d.tile).length > 0) {
      options.push({ seat, claim: 'chow' });
    }
  }
  return options;
}

/** Seats with at least one option — exactly the seats that owe a response. */
export function eligibleSeats(pending: PendingClaims): Seat[] {
  return [...new Set(pending.options.map((o) => o.seat))];
}

/**
 * The winning claim, or null if everyone passed.
 *
 * Called only once every eligible seat has responded; being asked earlier is a
 * caller bug, so it throws rather than guessing. Ties are broken by seat order
 * starting after `from` — the classic two-players-can-win-the-same-tile case,
 * where the seat closest to the discarder's left takes it.
 */
export function resolveClaims(pending: PendingClaims): ClaimAction | null {
  const seats = eligibleSeats(pending);
  const missing = seats.filter((s) => pending.responses[s] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `cannot resolve claims: seat(s) ${missing.join(', ')} have not responded ` +
        `(eligible: ${seats.join(', ')}, tile ${pending.tile} from seat ${pending.from})`,
    );
  }
  const claims = seats
    .map((s) => pending.responses[s]!)
    .filter((a): a is ClaimAction => a.type === 'claim');
  if (claims.length === 0) return null;

  const distance = (seat: Seat): number => (seat - pending.from + 4) % 4;
  claims.sort((a, b) =>
    PRIORITY[b.claim] - PRIORITY[a.claim] || distance(a.seat) - distance(b.seat),
  );
  return claims[0]!;
}
