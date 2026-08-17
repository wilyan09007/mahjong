import { describe, expect, it } from 'vitest';
import {
  formatAction, formatLegalActions, formatMeld, formatResult, formatState,
  formatTile, formatTiles, traceAction, traceHand,
} from '../src/debug.js';
import { assertInvariants, checkInvariants, EngineInvariantError } from '../src/invariants.js';
import { applyAction, legalActions, newHand } from '../src/game.js';
import type { GameState } from '../src/game.js';
import { FULL_TILE_SET } from '../src/tiles.js';
import type { Seat } from '../src/tiles.js';

function start(seed = 21): GameState {
  return newHand({ seed, dealer: 0, dealerStreak: 0, roundWind: 'E' });
}

describe('formatters', () => {
  it('renders every tile in the set without throwing or falling back', () => {
    for (const t of FULL_TILE_SET) {
      const s = formatTile(t);
      expect(s.length, `formatTile(${t}) produced "${s}"`).toBeGreaterThan(0);
      expect(s, `formatTile(${t}) leaked the raw code`).not.toBe(t);
    }
    expect(formatTile('3w')).toBe('3萬');
    expect(formatTile('7t')).toBe('7筒');
    expect(formatTile('1b')).toBe('1條');
    expect(formatTile('we')).toBe('東');
    expect(formatTile('dg')).toBe('發');
    expect(formatTile('f4')).toBe('花4');
  });

  it('keeps the paste-ready codes alongside the glyphs', () => {
    const line = formatTiles(['1w', 'dr']);
    expect(line).toContain('1w dr');
    expect(line).toContain('1萬中');
    expect(formatTiles([])).toBe('-');
  });

  it('describes melds with their origin', () => {
    expect(formatMeld({ type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 2 }))
      .toContain('from seat 2');
    expect(formatMeld({ type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null }))
      .toContain('concealed');
  });

  it('describes every action variant', () => {
    expect(formatAction({ type: 'discard', seat: 1, tile: '3w' })).toContain('3萬');
    expect(formatAction({ type: 'self-win', seat: 0 })).toContain('self-win');
    expect(formatAction({ type: 'concealed-kong', seat: 2, tile: '5t' })).toContain('concealed-kong');
    expect(formatAction({ type: 'added-kong', seat: 2, tile: '5t' })).toContain('added-kong');
    expect(formatAction({ type: 'claim', seat: 3, claim: 'chow', chowTiles: ['1w', '2w'] }))
      .toContain('1w+2w');
    expect(formatAction({ type: 'pass', seat: 3 })).toContain('pass');
  });

  it('dumps a state containing everything a bug report needs', () => {
    const dump = formatState(start());
    for (const fragment of [
      'seed=21', 'variant=taiwanese', 'phase=awaiting-discard', 'turn=seat 0',
      'wall', 'flags', 'lastDiscard', 'pendingClaims', 'pendingKong',
      'seat 0', 'seat 1', 'seat 2', 'seat 3', 'result',
    ]) {
      expect(dump, `state dump is missing "${fragment}"`).toContain(fragment);
    }
  });

  it('lists who can act, and says so plainly when nobody can', () => {
    expect(formatLegalActions(start())).toContain('seat 0:');
    const finished = { ...start(), phase: 'finished' as const };
    expect(formatLegalActions(finished)).toContain('nobody can act');
  });

  it('renders a null result and a real one', () => {
    expect(formatResult(null)).toBe('none');
    expect(formatResult({ type: 'draw-exhausted' })).toContain('draw-exhausted');
    const rendered = formatResult({
      type: 'win', winner: 1, by: 'discard', discarder: 2, winTile: '3w',
      tai: 3, breakdown: [{ name: '門清', tai: 1 }, { name: '平胡', tai: 2 }],
      payments: [0, 6, -6, 0],
      winningHand: { concealed: [], melds: [], flowers: [] },
    });
    expect(rendered).toContain('seat 1');
    expect(rendered).toContain('門清');
    expect(rendered).toContain('sum 0');
  });
});

describe('traceAction', () => {
  it('reports what the action changed', () => {
    const s0 = start();
    const tile = s0.players[0].hand[0]!;
    const { next, log } = traceAction(s0, { type: 'discard', seat: 0, tile });
    expect(next.players[0].discards).toEqual([tile]);
    const text = log.join('\n');
    expect(text).toContain('discard');
    expect(text).toContain('seat 0: hand 17→16');
    expect(text).toContain('wall');
  });

  it('attaches the offending state to a rejection instead of swallowing it', () => {
    const s0 = start();
    let caught: (Error & { trace?: string[] }) | undefined;
    try {
      traceAction(s0, { type: 'discard', seat: 1, tile: s0.players[1].hand[0]! });
    } catch (e) {
      caught = e as Error & { trace?: string[] };
    }
    expect(caught).toBeDefined();
    expect(caught!.trace?.join('\n')).toContain('REJECTED');
    expect(caught!.trace?.join('\n')).toContain('GameState');
  });
});

describe('traceHand', () => {
  it('plays a hand to the end and returns a readable transcript', () => {
    const { final, log, steps } = traceHand(start(), (_s, options) => {
      const pass = options.find((a) => a.type === 'pass');
      return pass ?? options.find((a) => a.type === 'discard') ?? options[0]!;
    });
    expect(final.phase).toBe('finished');
    expect(steps).toBeGreaterThan(0);
    expect(log.join('\n')).toContain('RESULT');
    expect(log.length).toBeGreaterThan(steps);
  });
});

describe('invariants', () => {
  it('accepts every state reachable in a real hand', () => {
    let s = assertInvariants(start(), 'opening deal');
    let guard = 0;
    while (s.phase !== 'finished') {
      expect(guard++).toBeLessThan(2000);
      const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const options = legalActions(s, seat);
      const action = options.find((a) => a.type === 'pass')
        ?? options.find((a) => a.type === 'discard')
        ?? options[0]!;
      s = assertInvariants(applyAction(s, action), `after step ${guard}`);
    }
    expect(s.phase).toBe('finished');
  });

  it('catches a duplicated tile', () => {
    const s = start();
    s.players[0].hand.push(s.players[1].hand[0]!);
    expect(checkInvariants(s).some((v) => v.includes('permutation') || v.includes('count')))
      .toBe(true);
  });

  it('catches a flower left in a hand', () => {
    const s = start();
    s.players[0].hand[0] = 'f1';
    expect(checkInvariants(s).some((v) => v.includes('flower'))).toBe(true);
  });

  it('catches an unsorted hand', () => {
    const s = start();
    s.players[0].hand.reverse();
    expect(checkInvariants(s).some((v) => v.includes('not sorted'))).toBe(true);
  });

  it('catches a malformed meld', () => {
    const s = start();
    s.players[1].hand = s.players[1].hand.slice(0, 13);
    s.players[1].melds.push({
      type: 'chow', tiles: ['1w', '5w', '9w'], concealed: false, claimedFrom: 0,
    });
    expect(checkInvariants(s).some((v) => v.includes('consecutive'))).toBe(true);
  });

  it('catches a wrong hand value', () => {
    const s = start();
    s.players[2].hand = s.players[2].hand.slice(0, 10);
    expect(checkInvariants(s).some((v) => v.includes('hand value'))).toBe(true);
  });

  it('catches a phase that disagrees with its result', () => {
    const s = { ...start(), phase: 'finished' as const };
    expect(checkInvariants(s).some((v) => v.includes('no result'))).toBe(true);
  });

  it('reports a flower in hand without crashing on the sortedness check', () => {
    // kindIndex throws on flowers. The checker must survive that and still
    // report the other problems it found.
    const s = start();
    s.players[0].hand[0] = 'f1';
    const violations = checkInvariants(s);
    expect(violations.some((v) => v.includes('flower'))).toBe(true);
    expect(violations.some((v) => v.includes('permutation') || v.includes('count'))).toBe(true);
  });

  it('throws with every violation and the full state attached', () => {
    const s = start();
    s.players[0].hand.reverse();
    s.players[2].hand = s.players[2].hand.slice(0, 10);
    let caught: EngineInvariantError | undefined;
    try {
      assertInvariants(s, 'deliberately broken');
    } catch (e) {
      caught = e as EngineInvariantError;
    }
    expect(caught).toBeInstanceOf(EngineInvariantError);
    expect(caught!.violations.length).toBeGreaterThan(1);
    expect(caught!.message).toContain('deliberately broken');
    expect(caught!.message).toContain('GameState');
  });
});
