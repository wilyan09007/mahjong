import { describe, expect, it } from 'vitest';
import { newHand } from '../src/game.js';
import { FLOWERS, isFlower, kindIndex } from '../src/tiles.js';
import type { Seat } from '../src/tiles.js';

describe('newHand', () => {
  const state = newHand({ seed: 123, dealer: 2, dealerStreak: 0, roundWind: 'E' });

  it('deals 16 tiles to non-dealers and 17 to the dealer', () => {
    expect(state.players[2].hand).toHaveLength(17);
    for (const s of [0, 1, 3] as const) {
      expect(state.players[s].hand).toHaveLength(16);
    }
  });
  it('leaves no flowers in any hand; exposed flowers are recorded', () => {
    for (const p of state.players) {
      expect(p.hand.some(isFlower)).toBe(false);
    }
  });
  it('never exposes the same flower twice — there is only one of each', () => {
    const exposed = state.players.flatMap((p) => p.flowers);
    expect(new Set(exposed).size, `duplicate flowers exposed: ${exposed.join(',')}`)
      .toBe(exposed.length);
    expect(exposed.length).toBeLessThanOrEqual(FLOWERS.length);
    for (const f of exposed) expect(isFlower(f)).toBe(true);
  });
  it('conserves all 144 tiles', () => {
    const inHands = state.players.reduce((n, p) => n + p.hand.length + p.flowers.length, 0);
    const inWall = state.wallBack - state.wallFront + 1;
    expect(inHands + inWall).toBe(144);
  });
  it('starts with the dealer to discard', () => {
    expect(state.turn).toBe(2);
    expect(state.phase).toBe('awaiting-discard');
    expect(state.lastDiscard).toBeNull();
  });
  it('records the dealer, streak, round wind and default stakes', () => {
    expect(state.dealer).toBe(2);
    expect(state.dealerStreak).toBe(0);
    expect(state.roundWind).toBe('E');
    expect(state.rules).toEqual({ base: 3, perTai: 1 });
    expect(state.result).toBeNull();
  });
  it('honours custom stakes when given', () => {
    const custom = newHand({
      seed: 1, dealer: 0, dealerStreak: 0, roundWind: 'E', rules: { base: 10, perTai: 5 },
    });
    expect(custom.rules).toEqual({ base: 10, perTai: 5 });
  });
  it('is deterministic per seed', () => {
    const again = newHand({ seed: 123, dealer: 2, dealerStreak: 0, roundWind: 'E' });
    expect(again).toEqual(state);
  });
  it('produces a different deal for a different seed', () => {
    const other = newHand({ seed: 124, dealer: 2, dealerStreak: 0, roundWind: 'E' });
    expect(other.players[0].hand).not.toEqual(state.players[0].hand);
  });
  it('hands are sorted by kindIndex', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const hand = state.players[seat].hand;
      const indexes = hand.map(kindIndex);
      for (let i = 1; i < indexes.length; i++) {
        expect(
          indexes[i]! >= indexes[i - 1]!,
          `seat ${seat} hand is out of order at position ${i}: ${hand.join(',')}`,
        ).toBe(true);
      }
    }
  });
  it('deals every seat from the same wall — no tile is dealt twice', () => {
    const dealt = state.players.flatMap((p) => [...p.hand, ...p.flowers]);
    for (const kind of new Set(dealt)) {
      const limit = isFlower(kind) ? 1 : 4;
      expect(
        dealt.filter((t) => t === kind).length,
        `${kind} was dealt more than the ${limit} that exist`,
      ).toBeLessThanOrEqual(limit);
    }
  });
  it('deals a legal opening position for every dealer seat', () => {
    for (const dealer of [0, 1, 2, 3] as Seat[]) {
      const s = newHand({ seed: 4242 + dealer, dealer, dealerStreak: 0, roundWind: 'E' });
      expect(s.turn).toBe(dealer);
      expect(s.players[dealer].hand).toHaveLength(17);
      const inHands = s.players.reduce((n, p) => n + p.hand.length + p.flowers.length, 0);
      expect(inHands + (s.wallBack - s.wallFront + 1)).toBe(144);
      for (const p of s.players) expect(p.hand.some(isFlower)).toBe(false);
    }
  });
});
