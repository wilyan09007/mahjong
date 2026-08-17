/**
 * Between-hands bookkeeping: who deals next, and when the session ends.
 *
 * 連莊 (dealer repeat): the dealer keeps the deal by winning, and also by an
 * exhaustive draw. Each repeat grows `dealerStreak`, which payments.ts turns
 * into the 連N拉N bonus. Any other seat winning passes the deal along and
 * resets the streak; when the deal passes seat 3 back to seat 0, one full lap
 * (圈) is done and the round wind advances E→S→W→N.
 */

import type { HandResult } from './game.js';
import type { Seat, Wind } from './tiles.js';

export interface SessionParams {
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  handsPlayed: number;
}

const WIND_CYCLE: Wind[] = ['E', 'S', 'W', 'N'];

export function nextHandParams(prev: SessionParams, result: HandResult): SessionParams {
  const dealerKeeps =
    result.type === 'draw-exhausted' || result.winner === prev.dealer;

  if (dealerKeeps) {
    return {
      dealer: prev.dealer,
      dealerStreak: prev.dealerStreak + 1,
      roundWind: prev.roundWind,
      handsPlayed: prev.handsPlayed + 1,
    };
  }

  const dealer = ((prev.dealer + 1) % 4) as Seat;
  // The deal wrapping past seat 3 completes a lap, which advances the round wind.
  const lapCompleted = dealer === 0;
  const windIndex = WIND_CYCLE.indexOf(prev.roundWind);
  return {
    dealer,
    dealerStreak: 0,
    roundWind: lapCompleted ? WIND_CYCLE[(windIndex + 1) % 4]! : prev.roundWind,
    handsPlayed: prev.handsPlayed + 1,
  };
}

/** Laps finished so far, read off the round wind: during the E round, zero. */
export function roundsCompleted(params: SessionParams): number {
  return WIND_CYCLE.indexOf(params.roundWind);
}

/**
 * Has the session run its configured number of rounds?
 *
 * `totalRounds` must be 1-3. `SessionParams` carries no lap counter — the round
 * wind IS the counter — and the wind wraps N→E, so "four rounds finished" and
 * "no rounds finished" are the same state and cannot be told apart. Rather than
 * return a confidently wrong answer for a 全莊 (4-round) session, this throws
 * and says what to change. Adding a `roundsCompleted` field to `SessionParams`
 * is the fix, and belongs with Plan 2's room configuration rather than here,
 * where it would change a shape Plan 1's contract pins down.
 */
export function isSessionOver(params: SessionParams, totalRounds: number): boolean {
  if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 3) {
    throw new Error(
      `totalRounds must be an integer 1-3, got ${totalRounds}. The round wind is ` +
        `the only lap counter in SessionParams and it wraps N→E, so a 4-round ` +
        `session is indistinguishable from a fresh one. Add an explicit ` +
        `roundsCompleted field to SessionParams to support it.`,
    );
  }
  return roundsCompleted(params) >= totalRounds;
}
