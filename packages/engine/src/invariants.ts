/**
 * Structural checks that must hold for EVERY reachable state.
 *
 * These are the properties the simulation test asserts thousands of times, and
 * they are the difference between "the engine produced a wrong answer" and
 * "the engine produced a wrong answer and we can see exactly which one broke
 * first". Everything here is pure: `checkInvariants` returns the list of
 * violations, `assertInvariants` throws with the whole state attached.
 *
 * A violation is always an engine bug. Never weaken an invariant to make a
 * failure go away — fix the engine.
 */

import { formatState } from './debug.js';
import type { GameState } from './game.js';
import { WALL_FLOOR } from './game.js';
import type { Meld } from './melds.js';
import {
  isFlower, isSuitTile, kindIndex, rankOf, sortTiles, suitOf,
  type Seat, type TileKind,
} from './tiles.js';

export class EngineInvariantError extends Error {
  readonly violations: string[];
  constructor(violations: string[], state: GameState, label?: string) {
    super(
      `${violations.length} engine invariant(s) violated` +
        (label ? ` (${label})` : '') + ':\n' +
        violations.map((v) => `  - ${v}`).join('\n') + '\n\n' + formatState(state),
    );
    this.name = 'EngineInvariantError';
    this.violations = violations;
  }
}

function meldViolations(seat: Seat, m: Meld, index: number): string[] {
  const out: string[] = [];
  const where = `seat ${seat} meld ${index} (${m.type} ${m.tiles.join('')})`;
  const size = m.type === 'kong' ? 4 : 3;
  if (m.tiles.length !== size) out.push(`${where}: expected ${size} tiles, has ${m.tiles.length}`);
  if (m.tiles.some(isFlower)) out.push(`${where}: contains a flower`);

  if (m.type === 'pung' || m.type === 'kong') {
    if (new Set(m.tiles).size !== 1) out.push(`${where}: tiles are not all identical`);
  } else {
    const suits = new Set(m.tiles.map((t) => suitOf(t)));
    if (!m.tiles.every(isSuitTile) || suits.size !== 1) {
      out.push(`${where}: a chow must be one suit`);
    } else {
      const ranks = m.tiles.map((t) => rankOf(t)!).sort((a, b) => a - b);
      if (ranks[1] !== ranks[0]! + 1 || ranks[2] !== ranks[1]! + 1) {
        out.push(`${where}: ranks ${ranks.join(',')} are not consecutive`);
      }
    }
    if (m.concealed) out.push(`${where}: a chow is always claimed, never concealed`);
  }

  if (m.concealed && m.claimedFrom !== null) {
    out.push(`${where}: concealed melds cannot name a claimedFrom seat`);
  }
  if (!m.concealed && m.claimedFrom === null) {
    out.push(`${where}: an exposed meld must name the seat it was claimed from`);
  }
  return out;
}

export function checkInvariants(s: GameState): string[] {
  const out: string[] = [];

  // 1. Exact tile conservation. Not just "144 things exist" — the multiset of
  //    everything held plus the live wall must equal the original wall, which
  //    also catches a tile being duplicated and another lost in the same step.
  const held: TileKind[] = [];
  for (const p of s.players) {
    held.push(...p.hand, ...p.flowers, ...p.discards, ...p.melds.flatMap((m) => m.tiles));
  }
  const live = s.tiles.slice(s.wallFront, s.wallBack + 1);
  const accounted = sortTiles([...held, ...live]);
  const expected = sortTiles(s.tiles);
  if (accounted.length !== expected.length) {
    out.push(`tile count is ${accounted.length}, expected ${expected.length}`);
  } else if (accounted.some((t, i) => t !== expected[i])) {
    const diff = accounted.filter((t, i) => t !== expected[i]).slice(0, 6);
    out.push(`tiles are not a permutation of the wall (first divergence near ${diff.join(' ')})`);
  }

  // 2. Wall indexes.
  if (s.wallFront > s.wallBack + 1) {
    out.push(`wallFront ${s.wallFront} overtook wallBack ${s.wallBack}`);
  }
  if (s.wallFront < 0 || s.wallBack >= s.tiles.length) {
    out.push(`wall indexes out of range: front=${s.wallFront} back=${s.wallBack}`);
  }

  // 3. Per-seat hand shape.
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const p = s.players[seat];
    const hasFlower = p.hand.some(isFlower);
    if (hasFlower) {
      out.push(`seat ${seat} is holding a flower in hand: ${p.hand.join(' ')}`);
    } else {
      // kindIndex throws on flowers, so only ask about order once we know there
      // are none — a checker that crashes reports one violation instead of all
      // of them, which is the opposite of what it is for.
      const indexes = p.hand.map(kindIndex);
      if (indexes.some((v, i) => i > 0 && v < indexes[i - 1]!)) {
        out.push(`seat ${seat} hand is not sorted: ${p.hand.join(' ')}`);
      }
    }
    p.melds.forEach((m, i) => out.push(...meldViolations(seat, m, i)));

    // A kong occupies four tiles but only three "slots", because its
    // replacement draw puts the count back. So a seat is worth 16, except:
    //   - the seat on turn may hold 17 (it has drawn and not yet discarded),
    //   - the WINNER holds 17 for good, that being the winning hand itself.
    const value = p.hand.length + p.melds.length * 3;
    let allowed: number[];
    let why: string;
    if (s.result?.type === 'win') {
      const isWinner = seat === s.result.winner;
      allowed = isWinner ? [17] : [16];
      why = isWinner ? ' as the winner' : '';
    } else {
      const onTurn = seat === s.turn && s.phase !== 'finished';
      allowed = onTurn ? [16, 17] : [16];
      why = onTurn ? ' while on turn' : '';
    }
    if (!allowed.includes(value)) {
      out.push(
        `seat ${seat} hand value is ${value} (hand ${p.hand.length} + ${p.melds.length} melds), ` +
          `expected ${allowed.join(' or ')}${why}`,
      );
    }
  }

  // 4. The drawn tile must still be where a self-win would look for it.
  //    Regression guard: a kong spends the previously drawn tile, and a stale
  //    lastDrawnTile let a following self-win score 槓上開花 against a tile no
  //    longer in the hand. Checking it here catches that at the kong, not
  //    several actions later inside scoring.
  if (s.phase === 'awaiting-discard' && s.drewThisTurn && s.lastDrawnTile !== null) {
    if (!s.players[s.turn].hand.includes(s.lastDrawnTile)) {
      out.push(
        `lastDrawnTile ${s.lastDrawnTile} is not in seat ${s.turn}'s hand ` +
          `(${s.players[s.turn].hand.join(' ')}) — a self-win would score against ` +
          `a tile that is not there`,
      );
    }
  }

  // 5. Phase consistency.
  if (s.phase === 'awaiting-claims' && s.pendingClaims === null) {
    out.push('phase is awaiting-claims but pendingClaims is null');
  }
  if (s.phase !== 'awaiting-claims' && s.pendingClaims !== null) {
    out.push(`phase is ${s.phase} but pendingClaims is still set`);
  }
  if (s.pendingClaims && s.pendingClaims.options.length === 0) {
    out.push('a claim window is open with no options — it should never have opened');
  }
  if (s.pendingClaims) {
    for (const seat of Object.keys(s.pendingClaims.responses).map(Number) as Seat[]) {
      if (!s.pendingClaims.options.some((o) => o.seat === seat)) {
        out.push(`seat ${seat} responded to a claim window it was not eligible for`);
      }
    }
  }
  if (s.phase === 'finished' && s.result === null) {
    out.push('hand is finished but carries no result');
  }
  if (s.phase !== 'finished' && s.result !== null) {
    out.push(`hand is ${s.phase} but already carries a result`);
  }
  if (s.pendingKong && s.phase === 'finished') {
    out.push('hand finished with an added kong still pending');
  }

  // 5. Results.
  if (s.result?.type === 'win') {
    const sum = s.result.payments.reduce((a, b) => a + b, 0);
    if (sum !== 0) out.push(`payments sum to ${sum}, not 0: ${s.result.payments.join(' ')}`);
    if (s.result.tai < 0) out.push(`negative tai: ${s.result.tai}`);
    if (s.result.by === 'discard' && s.result.discarder === null) {
      out.push('a discard win names no discarder');
    }
    if (s.result.by === 'self-draw' && s.result.discarder !== null) {
      out.push(`a self-draw win names discarder ${s.result.discarder}`);
    }
    if (s.result.discarder === s.result.winner) {
      out.push(`seat ${s.result.winner} won on their own discard`);
    }
    const sumTai = s.result.breakdown.reduce((n, b) => n + b.tai, 0);
    if (sumTai !== s.result.tai) {
      out.push(`breakdown sums to ${sumTai} but tai is ${s.result.tai}`);
    }
  }
  if (s.result?.type === 'draw-exhausted' && s.wallBack - s.wallFront + 1 > WALL_FLOOR) {
    out.push(
      `exhaustive draw declared with ${s.wallBack - s.wallFront + 1} tiles left, ` +
        `above the floor of ${WALL_FLOOR}`,
    );
  }

  return out;
}

/** Throw with every violation and the full state, or return the state unchanged. */
export function assertInvariants(s: GameState, label?: string): GameState {
  const violations = checkInvariants(s);
  if (violations.length > 0) throw new EngineInvariantError(violations, s, label);
  return s;
}
