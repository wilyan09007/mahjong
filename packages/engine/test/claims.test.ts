import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand, IllegalActionError } from '../src/game.js';
import type { GameState } from '../src/game.js';
import { resolveClaims, type PendingClaims } from '../src/claims.js';
import type { Seat, TileKind } from '../src/tiles.js';

/**
 * White-box rigging: deal a real hand, then force every seat to known contents.
 *
 * Overwriting hands deliberately breaks tile conservation (the same tile can
 * appear in two seats), which is fine here — these tests are about claim
 * legality and priority, and the conservation invariant is proved instead by
 * turnflow.test.ts and simulation.test.ts, which never rig anything.
 *
 * Unspecified seats get FILLER rather than their dealt tiles, so which seats
 * are eligible to claim never depends on the shuffle.
 */
function rig(hands: Partial<Record<Seat, TileKind[]>>): GameState {
  const s = newHand({ seed: 5, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    s.players[seat].hand = hands[seat] ?? [...FILLER];
  }
  return s;
}

/** 16 mutually unconnected tiles: cannot chow, pung, kong or win on anything. */
const FILLER: TileKind[] = [
  '1w', '4w', '7w', '2t', '5t', '8t', '3b', '6b', '9b',
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
];

describe('claim window', () => {
  it('opens for a pung and executes it with priority over chow', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],            // will discard 3w
      1: ['2w', '4w', ...FILLER.slice(0, 14)],       // next seat: chow 2w4w
      2: ['3w', '3w', ...FILLER.slice(2, 16)],       // pung
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    expect(s1.phase).toBe('awaiting-claims');
    expect(legalActions(s1, 1).map((a) => a.type)).toContain('claim');
    expect(legalActions(s1, 2).map((a) => a.type)).toContain('claim');

    const s2 = applyAction(s1, { type: 'claim', seat: 1, claim: 'chow', chowTiles: ['2w', '4w'] });
    const s3 = applyAction(s2, { type: 'claim', seat: 2, claim: 'pung' });
    expect(s3.phase).toBe('awaiting-discard');
    expect(s3.turn).toBe(2);
    expect(s3.players[2].melds).toEqual([
      { type: 'pung', tiles: ['3w', '3w', '3w'], concealed: false, claimedFrom: 0 },
    ]);
    expect(s3.players[2].hand).toHaveLength(14);      // 16 - 2 used in pung
    expect(s3.players[0].discards).toEqual([]);        // claimed tile removed
    expect(s3.pendingClaims).toBeNull();
  });

  it('gives the chow to the next seat when nobody outranks it', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      1: ['2w', '4w', ...FILLER.slice(0, 14)],
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    const s2 = applyAction(s1, { type: 'claim', seat: 1, claim: 'chow', chowTiles: ['2w', '4w'] });
    expect(s2.phase).toBe('awaiting-discard');
    expect(s2.turn).toBe(1);
    expect(s2.players[1].melds).toEqual([
      { type: 'chow', tiles: ['2w', '3w', '4w'], concealed: false, claimedFrom: 0 },
    ]);
    expect(s2.players[1].hand).toHaveLength(14);
    expect(s2.players[0].discards).toEqual([]);
  });

  it('only the seat after the discarder may chow', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      2: ['2w', '4w', ...FILLER.slice(0, 14)],  // could chow, but is two seats away
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    // Nobody is eligible at all, so the window never opens.
    expect(s1.phase).toBe('awaiting-discard');
    expect(s1.turn).toBe(1);
  });

  it('the discarder can never claim their own tile', () => {
    const s0 = rig({ 0: ['3w', '3w', ...FILLER.slice(2, 15), '3w'] });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    expect(s1.phase).toBe('awaiting-discard');
    expect(legalActions(s1, 0).some((a) => a.type === 'claim')).toBe(false);
  });

  it('advances normally when everyone passes', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      2: ['3w', '3w', ...FILLER.slice(2, 16)],
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    const s2 = applyAction(s1, { type: 'pass', seat: 2 });
    // seat 1 may also be eligible (chow); pass everyone eligible:
    const s3 = s2.phase === 'awaiting-claims' ? applyAction(s2, { type: 'pass', seat: 1 }) : s2;
    expect(s3.phase).toBe('awaiting-discard');
    expect(s3.turn).toBe(1);
    expect(s3.players[1].hand).toHaveLength(17);
    expect(s3.players[0].discards).toEqual(['3w']); // nobody claimed it, so it stays
  });

  it('win beats pung', () => {
    const winReady: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we',
    ]; // waits on we (pair wait)
    const s0 = rig({
      0: [...FILLER.slice(0, 15), 'we'],
      1: ['we', 'we', ...FILLER.slice(2, 16)],   // could pung
      3: winReady,                                // wins on we
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: 'we' });
    const s2 = applyAction(s1, { type: 'claim', seat: 1, claim: 'pung' });
    const s3 = applyAction(s2, { type: 'claim', seat: 3, claim: 'win' });
    expect(s3.phase).toBe('finished');
    expect(s3.players[3].hand).toHaveLength(17);
    expect(s3.players[0].discards).toEqual([]);

    expect(s3.result?.type).toBe('win');
    if (s3.result?.type !== 'win') throw new Error('expected a win result');
    expect(s3.result.winner).toBe(3);
    expect(s3.result.by).toBe('discard');
    expect(s3.result.discarder).toBe(0);
    expect(s3.result.winTile).toBe('we');
    expect(s3.result.payments.reduce((a, b) => a + b, 0)).toBe(0);
    expect(s3.result.payments[3]).toBeGreaterThan(0);
    expect(s3.result.payments[0]).toBeLessThan(0);
    expect(s3.result.tai).toBeGreaterThan(0);
    expect(s3.result.breakdown.length).toBeGreaterThan(0);
    expect(s3.result.winningHand.concealed).toHaveLength(17);
  });

  it('an exhausted wall produces a draw result, not a null one', () => {
    let s = newHand({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let guard = 0;
    while (s.phase !== 'finished') {
      expect(guard++).toBeLessThan(2000);
      if (s.phase === 'awaiting-claims') {
        const seat = ([0, 1, 2, 3] as const).find((x) => legalActions(s, x).length > 0)!;
        s = applyAction(s, { type: 'pass', seat });
      } else {
        s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
      }
    }
    expect(s.result).not.toBeNull();
    expect(s.result!.type).toBe('draw-exhausted');
  });

  it('claiming a kong from a discard draws a replacement and keeps the turn', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '5b'],
      2: ['5b', '5b', '5b', ...FILLER.slice(3, 16)],
    });
    const backBefore = s0.wallBack;
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '5b' });
    const s2 = applyAction(s1, { type: 'claim', seat: 2, claim: 'kong' });
    expect(s2.phase).toBe('awaiting-discard');
    expect(s2.turn).toBe(2);
    expect(s2.players[2].melds).toEqual([
      { type: 'kong', tiles: ['5b', '5b', '5b', '5b'], concealed: false, claimedFrom: 0 },
    ]);
    // 16 in hand - 3 into the kong + 1 replacement = 14
    expect(s2.players[2].hand).toHaveLength(14);
    expect(s2.wallBack).toBeLessThan(backBefore);
    expect(s2.lastDrawWasReplacement).toBe(true);
  });
});

describe('claim window rejections', () => {
  function opened(): GameState {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      2: ['3w', '3w', ...FILLER.slice(2, 16)],
    });
    return applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
  }

  it('rejects a claim from a seat with no option', () => {
    expect(() => applyAction(opened(), { type: 'claim', seat: 3, claim: 'pung' }))
      .toThrow(IllegalActionError);
  });
  it('rejects a claim the seat is not entitled to', () => {
    expect(() => applyAction(opened(), { type: 'claim', seat: 2, claim: 'kong' }))
      .toThrow(IllegalActionError);
  });
  it('rejects responding twice', () => {
    const s1 = applyAction(opened(), { type: 'pass', seat: 2 });
    // seat 2 was the only eligible seat, so the window already closed
    expect(() => applyAction(s1, { type: 'pass', seat: 2 })).toThrow(IllegalActionError);
  });
  it('rejects a chow without chowTiles, and with tiles not held', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      1: ['2w', '4w', ...FILLER.slice(0, 14)],
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    expect(() => applyAction(s1, { type: 'claim', seat: 1, claim: 'chow' }))
      .toThrow(IllegalActionError);
    expect(() => applyAction(s1, { type: 'claim', seat: 1, claim: 'chow', chowTiles: ['4w', '5w'] }))
      .toThrow(IllegalActionError);
  });
  it('rejects discarding while a claim window is open', () => {
    const s1 = opened();
    expect(() => applyAction(s1, { type: 'discard', seat: 1, tile: '1w' }))
      .toThrow(IllegalActionError);
  });
  it('offers pass plus one action per distinct chow window', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      1: ['1w', '2w', '4w', '5w', ...FILLER.slice(3, 15)],
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    const mine = legalActions(s1, 1);
    expect(mine.filter((a) => a.type === 'pass')).toHaveLength(1);
    const chows = mine.filter((a) => a.type === 'claim' && a.claim === 'chow');
    expect(chows).toHaveLength(3); // 1w2w / 2w4w / 4w5w
    for (const c of chows) {
      expect(() => applyAction(s1, c), `legalActions offered a rejected chow`).not.toThrow();
    }
  });
});

describe('resolveClaims priority', () => {
  const base = (options: PendingClaims['options'], responses: PendingClaims['responses'])
    : PendingClaims => ({ tile: '3w', from: 0, source: 'discard', options, responses });

  it('returns null when every eligible seat passed', () => {
    expect(resolveClaims(base(
      [{ seat: 1, claim: 'chow' }, { seat: 2, claim: 'pung' }],
      { 1: { type: 'pass', seat: 1 }, 2: { type: 'pass', seat: 2 } },
    ))).toBeNull();
  });
  it('ranks win over kong over pung over chow', () => {
    const winner = resolveClaims(base(
      [{ seat: 1, claim: 'chow' }, { seat: 2, claim: 'pung' }, { seat: 3, claim: 'win' }],
      {
        1: { type: 'claim', seat: 1, claim: 'chow', chowTiles: ['2w', '4w'] },
        2: { type: 'claim', seat: 2, claim: 'pung' },
        3: { type: 'claim', seat: 3, claim: 'win' },
      },
    ));
    expect(winner).toEqual({ type: 'claim', seat: 3, claim: 'win' });
  });
  it('breaks a tie between two wins by seat order after the discarder', () => {
    const winner = resolveClaims(base(
      [{ seat: 3, claim: 'win' }, { seat: 1, claim: 'win' }],
      {
        3: { type: 'claim', seat: 3, claim: 'win' },
        1: { type: 'claim', seat: 1, claim: 'win' },
      },
    ));
    expect(winner).toEqual({ type: 'claim', seat: 1, claim: 'win' });
  });
  it('throws loudly if asked to resolve before everyone answered', () => {
    expect(() => resolveClaims(base(
      [{ seat: 1, claim: 'chow' }, { seat: 2, claim: 'pung' }],
      { 1: { type: 'pass', seat: 1 } },
    ))).toThrow(/respond/i);
  });
});
