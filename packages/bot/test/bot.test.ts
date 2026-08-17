import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../src/bot.js';
import { shanten16 } from '../src/shanten.js';
import {
  applyAction, checkInvariants, formatState, legalActions, mulberry32, newHand, viewFor,
} from '@mahjong/engine';
import type { GameState, Seat } from '@mahjong/engine';

/**
 * No mocks: these drive the real engine through the real bot, four bot seats at
 * a time, exactly as the server will. The bot only ever sees `viewFor(...)`,
 * so if it ever needed hidden information these tests would not compile.
 */

interface Tally {
  wins: number;
  draws: number;
  selfDraws: number;
  claims: number;
  kongs: number;
  totalTai: number;
}

/** Play `games` full hands with all four seats driven by the bot. */
function playBotGames(games: number, seed0: number): Tally {
  const rng = mulberry32(99);
  const tally: Tally = { wins: 0, draws: 0, selfDraws: 0, claims: 0, kongs: 0, totalTai: 0 };

  for (let g = 0; g < games; g++) {
    let s: GameState = newHand({ seed: seed0 + g, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let steps = 0;

    while (s.phase !== 'finished') {
      expect(++steps, `game ${g} never finished`).toBeLessThan(1000);
      const violations = checkInvariants(s);
      expect(violations, `game ${g} step ${steps}: ${violations.join('; ')}\n${formatState(s)}`)
        .toEqual([]);

      const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const view = viewFor(s, seat);
      const action = chooseBotAction(view, rng);

      // The bot must only ever return something the engine offered it.
      expect(
        view.legalActions,
        `bot returned an action that was not offered: ${JSON.stringify(action)}`,
      ).toContainEqual(action);

      // And it must never decline a win.
      const canWin = view.legalActions.some(
        (a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win'),
      );
      if (canWin) {
        expect(
          action.type === 'self-win' || (action.type === 'claim' && action.claim === 'win'),
          `bot passed up a win at seat ${seat}`,
        ).toBe(true);
      }

      if (action.type === 'claim' && action.claim !== 'win') tally.claims++;
      if (action.type === 'concealed-kong' || action.type === 'added-kong') tally.kongs++;

      s = applyAction(s, action);
    }

    expect(s.result).not.toBeNull();
    if (s.result!.type === 'win') {
      tally.wins++;
      tally.totalTai += s.result!.tai;
      if (s.result!.by === 'self-draw') tally.selfDraws++;
      expect(s.result!.payments.reduce((a, b) => a + b, 0)).toBe(0);
    } else {
      tally.draws++;
    }
  }
  return tally;
}

describe('chooseBotAction', () => {
  it('always wins when winning is legal, and always returns a legal action', () => {
    const tally = playBotGames(50, 1);
    expect(tally.wins + tally.draws).toBe(50);
  });

  it('bots win far more often than random players do', () => {
    // Random play essentially never wins — the engine's own simulation test
    // found zero wins in 200 uniformly-random hands. A bot that cannot clear
    // this bar is not minimising shanten at all.
    const tally = playBotGames(50, 5000);
    expect(
      tally.wins,
      `only ${tally.wins}/50 hands ended in a win — the bot is not converging`,
    ).toBeGreaterThanOrEqual(10);
    expect(tally.totalTai, 'every win scored zero tai').toBeGreaterThan(0);
  });

  it('claims melds when they help and passes when they do not', () => {
    const tally = playBotGames(40, 9000);
    expect(tally.claims, 'the bot never claimed a meld in 40 hands').toBeGreaterThan(0);
  });

  it('refuses to act when handed no options, instead of inventing one', () => {
    const s = newHand({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    const idle = viewFor(s, 1); // not seat 0's turn — no legal actions
    expect(idle.legalActions).toEqual([]);
    expect(() => chooseBotAction(idle)).toThrow(/no legal actions/);
  });

  it('is deterministic for a given rng seed', () => {
    const run = (): string => {
      const rng = mulberry32(7);
      let s: GameState = newHand({ seed: 42, dealer: 0, dealerStreak: 0, roundWind: 'E' });
      let guard = 0;
      while (s.phase !== 'finished' && guard++ < 1000) {
        const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
        s = applyAction(s, chooseBotAction(viewFor(s, seat), rng));
      }
      return JSON.stringify(s.result);
    };
    expect(run()).toBe(run());
  });

  it('picks a discard that does not make the hand worse', () => {
    // Whatever it throws, the remaining hand must be at least as close to a win
    // as the worst legal alternative — i.e. it is choosing, not guessing.
    const rng = mulberry32(11);
    let s: GameState = newHand({ seed: 8, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let checked = 0;
    let guard = 0;

    while (s.phase !== 'finished' && guard++ < 400) {
      const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const view = viewFor(s, seat);
      const action = chooseBotAction(view, rng);

      if (action.type === 'discard' && view.phase === 'awaiting-discard') {
        const meldCount = view.melds.length;
        const chosen = shanten16(
          view.hand.filter((t, i) => i !== view.hand.indexOf(action.tile)),
          meldCount,
        );
        const alternatives = view.legalActions
          .filter((a): a is Extract<typeof a, { type: 'discard' }> => a.type === 'discard')
          .map((a) => {
            const rest = [...view.hand];
            rest.splice(rest.indexOf(a.tile), 1);
            return shanten16(rest, meldCount);
          });
        expect(chosen, `seat ${seat} threw a tile worse than the best available`)
          .toBeLessThanOrEqual(Math.min(...alternatives) + 0);
        checked++;
      }
      s = applyAction(s, action);
    }
    expect(checked, 'no discard decision was ever examined').toBeGreaterThan(5);
  });
});
