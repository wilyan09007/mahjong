import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES, IllegalActionError, applyAction, assertInvariants, legalActions, newHand,
  type Action, type GameState, type HandRules, type Seat, type TileKind,
} from '../src/index.js';
import { DEFAULT_CANTONESE_RULES, type CantoneseRules } from '../src/scoring/cantonese.js';

/**
 * The Hong Kong variant running through the real state machine: the 13-tile
 * deal, the minimum-番 gate on every path to a win, the seven-pairs switch,
 * and whole games under each house option with every invariant checked at
 * every step.
 */

function rules(over: Partial<CantoneseRules> = {}): HandRules {
  return { ...DEFAULT_RULES, cantonese: { ...DEFAULT_CANTONESE_RULES, ...over } };
}

function hkHand(seed: number, over: Partial<CantoneseRules> = {}): GameState {
  return newHand({ seed, dealer: 0, dealerStreak: 0, roundWind: 'E', variantId: 'cantonese', rules: rules(over) });
}

/**
 * Seat 0 is about to throw `4b`; seat 1 waits on it. Hands are set directly —
 * tile conservation does not hold in a rigged state, so these tests check the
 * claim logic, not invariants.
 */
function rigged(seat1: TileKind[], over: Partial<CantoneseRules>): GameState {
  const s = hkHand(5, over);
  s.players[0].hand = ['4b', '1w', '1w', '5w', '5w', '9w', '1t', '5t', '9t', 'we', 'ws', 'ww', 'wn', 'dr'];
  s.players[1].hand = seat1;
  s.players[1].flowers = ['f1']; // not seat 1's own flower: no 無花, no 正花
  s.players[2].hand = ['2w', '6w', '7w', '2t', '3t', '7t', '8t', '5b', '6b', '9b', 'dg', 'dg', 'dw'];
  s.players[3].hand = ['3w', '4w', '8w', '6t', '8t', '1b', '6b', '8b', '9b', 'we', 'ws', 'dr', 'dw'];
  // Some earlier play, so this is not the dealer's first discard — winning on
  // that would be 地糊, a 13-番 limit hand, and would prove nothing here.
  s.players[2].discards = ['9w'];
  s.players[3].discards = ['8w'];
  return s;
}

// A chicken hand waiting on 1b/4b: with 門前清 it scores exactly 1 番.
const CHICKEN_WAIT: TileKind[] = ['1w', '2w', '3w', '4t', '5t', '6t', '7b', '7b', '7b', '2b', '3b', '9w', '9w'];
// Six pairs and a lone 4b: seven pairs on 4b (5 番).
const PAIRS_WAIT: TileKind[] = ['1w', '1w', '3w', '3w', '5t', '5t', '7t', '7t', '2b', '2b', '9b', '9b', '4b'];

const winOffered = (s: GameState, seat: Seat) =>
  legalActions(s, seat).some((a) => a.type === 'claim' && a.claim === 'win');

describe('Hong Kong deal', () => {
  it('deals 13 to each player and 14 to the dealer, and every invariant holds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = hkHand(seed);
      expect(s.players.map((p) => p.hand.length + p.melds.length * 3)).toEqual([14, 13, 13, 13]);
      assertInvariants(s);
    }
  });
});

describe('the minimum to win', () => {
  it('offers a 1-番 hand only when the house minimum allows it', () => {
    const discard = (s: GameState) => applyAction(s, { type: 'discard', seat: 0, tile: '4b' });
    expect(winOffered(discard(rigged(CHICKEN_WAIT, { minFaan: 3 })), 1)).toBe(false);
    expect(winOffered(discard(rigged(CHICKEN_WAIT, { minFaan: 1 })), 1)).toBe(true);
    expect(winOffered(discard(rigged(CHICKEN_WAIT, { minFaan: 0 })), 1)).toBe(true);
  });

  it('gates the self-draw too, and refuses one declared anyway', () => {
    const s = rigged(CHICKEN_WAIT, { minFaan: 3 });
    // Seat 1 has drawn the 4b itself and is on turn.
    s.players[1].hand = ['1w', '2w', '3w', '4t', '5t', '6t', '2b', '3b', '4b', '7b', '7b', '7b', '9w', '9w'];
    Object.assign(s, { turn: 1, drewThisTurn: true, lastDrawnTile: '4b' });
    // Self-drawn adds 自摸: 1 + 1 = 2, still under 3.
    expect(legalActions(s, 1).some((a) => a.type === 'self-win')).toBe(false);
    expect(() => applyAction(s, { type: 'self-win', seat: 1 })).toThrow(IllegalActionError);
    s.rules = rules({ minFaan: 1 });
    expect(legalActions(s, 1).some((a) => a.type === 'self-win')).toBe(true);
  });
});

describe('first-turn limit hands', () => {
  it('a win on the dealer’s very first discard is 地糊, 13 番', () => {
    let s = rigged(CHICKEN_WAIT, { minFaan: 3 });
    s.players[2].discards = [];
    s.players[3].discards = [];
    s = applyAction(s, { type: 'discard', seat: 0, tile: '4b' });
    expect(winOffered(s, 1)).toBe(true); // a 1-番 shape, but 地糊 clears any minimum
    s = applyAction(s, { type: 'claim', seat: 1, claim: 'win' });
    for (const seat of [2, 3] as Seat[]) if (legalActions(s, seat).length) s = applyAction(s, { type: 'pass', seat });
    expect(s.result?.type === 'win' && s.result.breakdown).toEqual([{ name: '地糊', tai: 13 }]);
  });
});

describe('seven pairs', () => {
  it('is a winning shape only when the house allows it', () => {
    const discard = (s: GameState) => applyAction(s, { type: 'discard', seat: 0, tile: '4b' });
    expect(winOffered(discard(rigged(PAIRS_WAIT, { sevenPairs: true })), 1)).toBe(true);
    expect(winOffered(discard(rigged(PAIRS_WAIT, { sevenPairs: false })), 1)).toBe(false);
  });

  it('scores 5 番 when won', () => {
    let s = applyAction(rigged(PAIRS_WAIT, {}), { type: 'discard', seat: 0, tile: '4b' });
    for (const seat of [1, 2, 3] as Seat[]) {
      const mine = legalActions(s, seat);
      if (mine.length === 0) continue;
      const win = mine.find((a) => a.type === 'claim' && a.claim === 'win');
      s = applyAction(s, win ?? { type: 'pass', seat });
    }
    expect(s.result?.type).toBe('win');
    if (s.result?.type === 'win') expect(s.result.breakdown).toContainEqual({ name: '七對子', tai: 5 });
  });
});

/** A greedy table: take any win, then any pung or kong, else discard the first tile. */
function step(state: GameState, seed: number): GameState {
  const all = ([0, 1, 2, 3] as Seat[]).flatMap((s) => legalActions(state, s));
  const pick = (pred: (a: Action) => boolean) => all.find(pred);
  const discards = all.filter((a) => a.type === 'discard');
  const action =
    pick((a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win')) ??
    pick((a) => a.type === 'claim' && (a.claim === 'pung' || a.claim === 'kong')) ??
    (discards.length > 0 ? discards[(seed * 7 + state.wallFront) % discards.length] : undefined) ??
    pick((a) => a.type === 'pass');
  if (!action) throw new Error(`stuck in ${state.phase}`);
  return applyAction(state, action);
}

describe('whole Hong Kong games', () => {
  const houses: Partial<CantoneseRules>[] = [
    { minFaan: 0 },
    { minFaan: 3 },
    { minFaan: 5, maxFaan: 10, payment: 'full', sevenPairs: false },
  ];
  for (const house of houses) {
    it(`plays to an end with every invariant intact: ${JSON.stringify(house)}`, () => {
      const cfg = { ...DEFAULT_CANTONESE_RULES, ...house };
      let wins = 0;
      for (let seed = 1; seed <= 120; seed++) {
        let s = hkHand(seed, house);
        for (let i = 0; i < 3000 && !s.result; i++) {
          s = step(s, seed);
          assertInvariants(s);
        }
        expect(s.result, `seed ${seed} never finished`).not.toBeNull();
        if (s.result?.type === 'win') {
          wins++;
          expect(s.result.tai).toBeGreaterThanOrEqual(cfg.minFaan);
          expect(s.result.tai).toBeLessThanOrEqual(cfg.maxFaan);
          expect(s.result.payments.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
        }
      }
      expect(wins, 'no hand was ever won — the gate or the shapes are broken').toBeGreaterThan(0);
    });
  }
});
