import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand, IllegalActionError } from '../src/game.js';
import type { GameState } from '../src/game.js';
import type { Seat, TileKind } from '../src/tiles.js';

/** 16 mutually unconnected tiles — cannot claim, kong or win on anything here. */
const FILLER: TileKind[] = [
  '1w', '4w', '7w', '2t', '5t', '8t', '3b', '6b', '9b',
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
];

/**
 * White-box rigging, as in claims.test.ts: unspecified seats get FILLER so that
 * who is eligible to rob never depends on the shuffle. Tile conservation is
 * deliberately not preserved here; simulation.test.ts proves that separately.
 */
function rig(hands: Partial<Record<Seat, TileKind[]>>, turn: Seat = 0): GameState {
  const s = newHand({ seed: 11, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    s.players[seat].hand = hands[seat] ?? [...FILLER];
  }
  s.turn = turn;
  return s;
}

describe('concealed kong', () => {
  const hand: TileKind[] = [
    '5t', '5t', '5t', '5t', '1w', '2w', '3w', '4w', '6w', '7w', '8w', '9w',
    '1b', '2b', '3b', 'dr', 'dg',
  ]; // dealer's 17

  it('exposes the meld and draws a replacement from the back', () => {
    const s0 = rig({ 0: hand });
    const backBefore = s0.wallBack;
    const s1 = applyAction(s0, { type: 'concealed-kong', seat: 0, tile: '5t' });
    expect(s1.players[0].melds).toEqual([
      { type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null },
    ]);
    expect(s1.players[0].hand).toHaveLength(14); // 17 - 4 + 1 replacement
    expect(s1.wallBack).toBeLessThan(backBefore);
    expect(s1.turn).toBe(0);
    expect(s1.phase).toBe('awaiting-discard');
    expect(s1.lastDrawWasReplacement).toBe(true);
  });

  it('is offered by legalActions and is applicable when offered', () => {
    const s0 = rig({ 0: hand });
    const offered = legalActions(s0, 0).filter((a) => a.type === 'concealed-kong');
    expect(offered).toEqual([{ type: 'concealed-kong', seat: 0, tile: '5t' }]);
    expect(() => applyAction(s0, offered[0]!)).not.toThrow();
  });

  it('rejects a kong of a kind not held four times, and out of turn', () => {
    const s0 = rig({ 0: hand });
    expect(() => applyAction(s0, { type: 'concealed-kong', seat: 0, tile: '1w' }))
      .toThrow(IllegalActionError);
    expect(() => applyAction(s0, { type: 'concealed-kong', seat: 1, tile: '5t' }))
      .toThrow(IllegalActionError);
  });

  it('leaves the kong declarer able to keep playing', () => {
    const s1 = applyAction(rig({ 0: hand }), { type: 'concealed-kong', seat: 0, tile: '5t' });
    expect(legalActions(s1, 0).some((a) => a.type === 'discard')).toBe(true);
  });
});

describe('added kong and robbing', () => {
  const winReady: TileKind[] = [
    '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
    '1t', '1t', '1t', 'dr', 'dr', 'dr', 'ws',
  ]; // waits on ws

  const declarerHand: TileKind[] = [
    'ws', '1b', '2b', '3b', '4b', '5b', '6b', '7b', '8b', '9b',
    '1t', '2t', '3t', '4t', '6t', '7t', '8t',
  ];

  function rigged(): GameState {
    const s0 = rig({ 0: declarerHand, 2: winReady });
    s0.players[0].melds = [
      { type: 'pung', tiles: ['ws', 'ws', 'ws'], concealed: false, claimedFrom: 3 },
    ];
    return s0;
  }

  it('can be robbed for the win', () => {
    const s1 = applyAction(rigged(), { type: 'added-kong', seat: 0, tile: 'ws' });
    expect(s1.phase).toBe('awaiting-claims');
    const s2 = applyAction(s1, { type: 'claim', seat: 2, claim: 'win' });
    expect(s2.phase).toBe('finished');
    expect(s2.wasKongRob).toBe(true);
    // The robbed tile ends up in the winner's hand and leaves the declarer's.
    expect(s2.players[2].hand).toHaveLength(17);
    expect(s2.players[2].hand.filter((t) => t === 'ws')).toHaveLength(2);
    expect(s2.players[0].hand.filter((t) => t === 'ws')).toHaveLength(0);
    // The meld stays a pung — the kong never completed.
    expect(s2.players[0].melds[0]!.type).toBe('pung');

    expect(s2.result?.type).toBe('win');
    if (s2.result?.type !== 'win') throw new Error('expected a win result');
    expect(s2.result.winner).toBe(2);
    expect(s2.result.discarder).toBe(0);
    expect(s2.result.winTile).toBe('ws');
    expect(s2.result.breakdown).toContainEqual({ name: '搶槓', tai: 1 });
    expect(s2.result.payments.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('offers the rob only as a win, and only to seats that can take it', () => {
    const s1 = applyAction(rigged(), { type: 'added-kong', seat: 0, tile: 'ws' });
    expect(legalActions(s1, 2).map((a) => a.type === 'claim' ? a.claim : a.type).sort())
      .toEqual(['pass', 'win']);
    expect(legalActions(s1, 1)).toEqual([]);
    expect(legalActions(s1, 3)).toEqual([]);
    // The declarer cannot rob their own kong.
    expect(legalActions(s1, 0)).toEqual([]);
    expect(() => applyAction(s1, { type: 'claim', seat: 0, claim: 'win' }))
      .toThrow(IllegalActionError);
  });

  it('proceeds with replacement when nobody robs', () => {
    const s1 = applyAction(rigged(), { type: 'added-kong', seat: 0, tile: 'ws' });
    const s2 = applyAction(s1, { type: 'pass', seat: 2 });
    expect(s2.phase).toBe('awaiting-discard');
    expect(s2.turn).toBe(0);
    expect(s2.players[0].melds[0]!.type).toBe('kong');
    expect(s2.players[0].melds[0]!.tiles).toEqual(['ws', 'ws', 'ws', 'ws']);
    expect(s2.players[0].hand).toHaveLength(17); // 17 - 1 kong tile + 1 replacement
    expect(s2.lastDrawWasReplacement).toBe(true);
    expect(s2.wasKongRob).toBe(false);
  });

  it('completes immediately when nobody could possibly rob', () => {
    const s0 = rig({ 0: declarerHand }); // seats 1-3 all hold FILLER
    s0.players[0].melds = [
      { type: 'pung', tiles: ['ws', 'ws', 'ws'], concealed: false, claimedFrom: 3 },
    ];
    const s1 = applyAction(s0, { type: 'added-kong', seat: 0, tile: 'ws' });
    expect(s1.phase).toBe('awaiting-discard');
    expect(s1.players[0].melds[0]!.type).toBe('kong');
  });

  it('rejects an added kong with no matching exposed pung', () => {
    const s0 = rig({ 0: declarerHand });
    expect(() => applyAction(s0, { type: 'added-kong', seat: 0, tile: 'ws' }))
      .toThrow(IllegalActionError);
  });

  it('rejects an added kong of a tile not in hand', () => {
    const s0 = rigged();
    expect(() => applyAction(s0, { type: 'added-kong', seat: 0, tile: '9t' }))
      .toThrow(IllegalActionError);
  });
});

describe('kong tile accounting in a real hand', () => {
  /** Unrigged: play a genuine hand and take every kong offered. */
  it('conserves 144 tiles through concealed and added kongs', () => {
    let kongsSeen = 0;
    for (let seed = 0; seed < 60; seed++) {
      let s = newHand({ seed, dealer: 0, dealerStreak: 0, roundWind: 'E' });
      let guard = 0;
      while (s.phase !== 'finished') {
        expect(guard++).toBeLessThan(2000);
        const held = s.players.reduce(
          (n, p) => n + p.hand.length + p.flowers.length + p.discards.length
            + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
          0,
        );
        expect(held + (s.wallBack - s.wallFront + 1), `seed ${seed} step ${guard}`).toBe(144);

        if (s.phase === 'awaiting-claims') {
          const seat = ([0, 1, 2, 3] as const).find((x) => legalActions(s, x).length > 0)!;
          s = applyAction(s, { type: 'pass', seat });
          continue;
        }
        const options = legalActions(s, s.turn);
        const kong = options.find(
          (a) => a.type === 'concealed-kong' || a.type === 'added-kong',
        );
        if (kong) kongsSeen++;
        s = applyAction(s, kong ?? options.find((a) => a.type === 'discard')!);
      }
    }
    // If this ever reaches zero the test has stopped covering kongs at all.
    expect(kongsSeen, 'no kong was ever offered across 60 seeds').toBeGreaterThan(0);
  });
});
