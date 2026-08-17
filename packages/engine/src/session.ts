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
  /**
   * Full laps of the deal completed so far.
   *
   * This exists because the round wind cannot count them. The wind wraps N→E,
   * so after four laps it reads 'E' again — identical to a session that has not
   * started. An explicit counter is the only way to express a 全莊 (4-round)
   * session, which is the standard Taiwanese format and one of the round counts
   * the room lobby offers.
   */
  roundsCompleted: number;
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
      roundsCompleted: prev.roundsCompleted,
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
    roundsCompleted: prev.roundsCompleted + (lapCompleted ? 1 : 0),
  };
}

/** A fresh session: East round, seat 0 deals, nothing played yet. */
export function newSession(dealer: Seat = 0): SessionParams {
  return { dealer, dealerStreak: 0, roundWind: 'E', handsPlayed: 0, roundsCompleted: 0 };
}

/**
 * Has the session run its configured number of rounds?
 *
 * 1-4 rounds. Four is 全莊, the standard Taiwanese full game, and it works
 * because `roundsCompleted` counts laps explicitly rather than reading them off
 * the round wind — which wraps N→E and so cannot tell a finished session from a
 * fresh one.
 */
export function isSessionOver(params: SessionParams, totalRounds: number): boolean {
  if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 4) {
    throw new Error(
      `totalRounds must be an integer 1-4, got ${totalRounds} — a session runs ` +
        `at most one lap per wind (E/S/W/N)`,
    );
  }
  return params.roundsCompleted >= totalRounds;
}
