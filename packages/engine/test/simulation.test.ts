import { describe, expect, it } from 'vitest';
import {
  applyAction, assertInvariants, checkInvariants, formatAction, formatState,
  isSessionOver, isSuitTile, legalActions, mulberry32, newHand, nextHandParams,
  rankOf, suitOf,
  type Action, type GameState, type Seat, type SessionParams, type TileKind,
} from '../src/index.js';

/**
 * The property tests. Everything here imports from `../src/index.js` ONLY — if
 * the public surface were not enough to play complete games, this file would
 * not compile, which is exactly the guarantee the Plan 2 server needs.
 *
 * No mocks, no stubs, no hand-rigging: real seeds, real walls, real hands,
 * played to the end through the engine's own legal actions. Set
 * MAHJONG_DEBUG=1 to print per-hand summaries.
 *
 * TWO policies, because they prove different things:
 *
 *   1. UNIFORM RANDOM explores the state space. It takes strange action
 *      sequences a sensible player never would, which is what shakes out
 *      illegal states. It essentially never wins — random discarding does not
 *      converge on a winning shape — so it cannot cover scoring.
 *
 *   2. GREEDY plays to win: take a win when offered, claim every meld, and
 *      discard the least connected tile. That reaches real wins, which is the
 *      only way the scoring and payment paths get exercised end to end.
 *
 * A failure in either is a real engine bug. Fix the engine — never weaken the
 * invariant to make the suite green.
 */

const VERBOSE = process.env['MAHJONG_DEBUG'] === '1';

function totalTiles(s: GameState): number {
  const held = s.players.reduce(
    (n, p) => n + p.hand.length + p.flowers.length + p.discards.length
      + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
    0,
  );
  return held + (s.wallBack - s.wallFront + 1);
}

/** Fail with the whole story: which hand, which step, and the state itself. */
function fail(seed: number, step: number, why: string, s: GameState, log: string[]): never {
  const shown = log.slice(-40);
  throw new Error(
    `${why}\n\nseed=${seed} step=${step}\n\n` +
      `--- last ${shown.length} actions ---\n${shown.join('\n')}\n\n` +
      `--- state ---\n${formatState(s)}`,
  );
}

/**
 * How much a tile is worth keeping: duplicates count most, then immediate
 * neighbours, then the gap-one neighbours that a run can still bridge. The
 * least connected tile is the one to throw.
 */
function connectivity(hand: TileKind[], t: TileKind): number {
  const count = (x: TileKind): number => hand.filter((h) => h === x).length;
  let score = (count(t) - 1) * 3;
  if (isSuitTile(t)) {
    const rank = rankOf(t)!;
    const suit = suitOf(t)!;
    for (const delta of [-2, -1, 1, 2]) {
      const r = rank + delta;
      if (r >= 1 && r <= 9) {
        score += count(`${r}${suit}` as TileKind) * (Math.abs(delta) === 1 ? 2 : 1);
      }
    }
  }
  return score;
}

/**
 * Win if you can, kong if you can, claim what you can, otherwise throw your
 * loosest tile. Kongs come before claims so that the replacement-draw path —
 * and 槓上開花 with it — actually gets played, not just unit-tested.
 */
function greedyChoice(s: GameState, options: Action[]): Action {
  const win = options.find((a) => a.type === 'self-win')
    ?? options.find((a) => a.type === 'claim' && a.claim === 'win');
  if (win) return win;

  const kong = options.find((a) => a.type === 'concealed-kong' || a.type === 'added-kong');
  if (kong) return kong;

  const claim = options.find((a) => a.type === 'claim');
  if (claim) return claim;

  const discards = options.filter((a): a is Extract<Action, { type: 'discard' }> =>
    a.type === 'discard');
  if (discards.length > 0) {
    const hand = s.players[discards[0]!.seat].hand;
    return discards.reduce((worst, a) =>
      connectivity(hand, a.tile) < connectivity(hand, worst.tile) ? a : worst);
  }
  return options[0]!;
}

/** Drive one hand to its end, checking every intermediate state. */
function playHand(
  seed: number,
  session: SessionParams,
  choose: (s: GameState, options: Action[]) => Action,
  rng: () => number,
): { final: GameState; steps: number; kongs: number } {
  let s = newHand({
    seed,
    dealer: session.dealer,
    dealerStreak: session.dealerStreak,
    roundWind: session.roundWind,
  });
  const log: string[] = [];
  let steps = 0;
  let kongs = 0;

  while (s.phase !== 'finished') {
    if (++steps >= 1000) fail(seed, steps, 'hand exceeded 1000 steps', s, log);
    if (totalTiles(s) !== 144) {
      fail(seed, steps, `tile conservation broke: ${totalTiles(s)} tiles`, s, log);
    }
    const violations = checkInvariants(s);
    if (violations.length > 0) {
      fail(seed, steps, `invariants violated:\n  - ${violations.join('\n  - ')}`, s, log);
    }

    const actors = ([0, 1, 2, 3] as Seat[]).filter((x) => legalActions(s, x).length > 0);
    if (actors.length === 0) fail(seed, steps, 'deadlock: no seat can act', s, log);

    const seat = actors[Math.floor(rng() * actors.length)]!;
    const options = legalActions(s, seat);
    const action = choose(s, options);
    if (!options.includes(action)) {
      fail(seed, steps, `policy returned an action that was not offered: ${formatAction(action)}`, s, log);
    }
    log.push(`${steps}. ${formatAction(action)}`);
    if (action.type === 'concealed-kong' || action.type === 'added-kong') kongs++;

    const before = s;
    try {
      s = applyAction(s, action);
    } catch (error) {
      fail(
        seed, steps,
        `legalActions offered an action applyAction rejected: ` +
          `${formatAction(action)} → ${(error as Error).message}`,
        before, log,
      );
    }
  }

  assertInvariants(s, `seed ${seed} final state`);
  if (s.result === null) fail(seed, steps, 'hand finished with no result', s, log);
  if (s.result.type === 'win') {
    const sum = s.result.payments.reduce((a, b) => a + b, 0);
    if (sum !== 0) fail(seed, steps, `payments sum to ${sum}, not 0`, s, log);
    const breakdownSum = s.result.breakdown.reduce((n, b) => n + b.tai, 0);
    if (breakdownSum !== s.result.tai) {
      fail(seed, steps, `breakdown sums to ${breakdownSum} but tai is ${s.result.tai}`, s, log);
    }
    if (s.result.tai < 0) fail(seed, steps, `negative tai ${s.result.tai}`, s, log);
  }
  return { final: s, steps, kongs };
}

describe('random full-game simulation', () => {
  it('plays 200 hands of uniform-random legal actions without an illegal state', () => {
    const rng = mulberry32(2026);
    let session: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    let kongs = 0;
    let finished = 0;

    for (let hand = 0; hand < 200; hand++) {
      const seed = hand * 7919 + 1;
      const result = playHand(seed, session, (_s, options) =>
        options[Math.floor(rng() * options.length)]!, rng);
      kongs += result.kongs;
      finished++;
      session = nextHandParams(session, result.final.result!);
    }

    expect(finished).toBe(200);
    expect(session.handsPlayed).toBe(200);
    // If random play stops declaring kongs, this test has quietly stopped
    // covering the kong and replacement-draw paths.
    expect(kongs, 'random play never declared a kong across 200 hands').toBeGreaterThan(0);
  });

  it('plays 200 hands of greedy play, reaching real wins and scoring them', () => {
    const rng = mulberry32(4242);
    let session: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    let wins = 0;
    let draws = 0;
    let selfDraws = 0;
    let kongs = 0;
    let totalTai = 0;

    for (let hand = 0; hand < 200; hand++) {
      const seed = hand * 104729 + 7;
      const { final, kongs: k } = playHand(seed, session, greedyChoice, rng);
      kongs += k;
      if (final.result!.type === 'win') {
        wins++;
        totalTai += final.result!.tai;
        if (final.result!.by === 'self-draw') selfDraws++;
      } else {
        draws++;
      }
      session = nextHandParams(session, final.result!);
    }

    if (VERBOSE) {
      // eslint-disable-next-line no-console
      console.log({ wins, draws, selfDraws, kongs, avgTai: totalTai / Math.max(wins, 1) });
    }

    expect(wins + draws).toBe(200);
    // These are the guards that matter: without wins, nothing above proves the
    // scoring or payment paths run at all.
    expect(wins, 'greedy play never produced a win in 200 hands').toBeGreaterThan(0);
    expect(selfDraws, 'greedy play never produced a self-draw win').toBeGreaterThan(0);
    expect(totalTai, 'every win scored zero tai').toBeGreaterThan(0);
    expect(kongs, 'greedy play never declared a kong').toBeGreaterThan(0);
  });

  it('is reproducible: the same seeds replay to the same results', () => {
    const play = (): string[] => {
      const rng = mulberry32(77);
      const out: string[] = [];
      for (let hand = 0; hand < 10; hand++) {
        let s = newHand({ seed: hand + 500, dealer: 0, dealerStreak: 0, roundWind: 'E' });
        let guard = 0;
        while (s.phase !== 'finished' && guard++ < 1000) {
          const actors = ([0, 1, 2, 3] as Seat[]).filter((x) => legalActions(s, x).length > 0);
          const seat = actors[Math.floor(rng() * actors.length)]!;
          const options = legalActions(s, seat);
          s = applyAction(s, options[Math.floor(rng() * options.length)]!);
        }
        out.push(JSON.stringify(s.result));
      }
      return out;
    };
    expect(play()).toEqual(play());
  });

  it('runs a whole session to its configured end', () => {
    const rng = mulberry32(31337);
    let session: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    let guard = 0;
    while (!isSessionOver(session, 1)) {
      expect(guard++, 'a 1-round session never ended').toBeLessThan(300);
      const { final } = playHand(90000 + guard, session, greedyChoice, rng);
      session = nextHandParams(session, final.result!);
    }
    expect(session.roundWind).toBe('S');
    expect(session.dealer).toBe(0);
    expect(session.handsPlayed).toBeGreaterThanOrEqual(4);
  });
});
