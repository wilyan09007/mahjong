import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand, viewFor } from '../src/index.js';
import type { GameState } from '../src/index.js';
import type { Seat } from '../src/tiles.js';

/**
 * `viewFor` is the single choke point that decides what a client may see.
 * These tests are the security boundary, so they check the *serialized* view —
 * what actually goes on the wire — not just the TypeScript type, which a
 * server bug could bypass with a stray spread.
 */

const state = newHand({ seed: 77, dealer: 0, dealerStreak: 0, roundWind: 'E' });

describe('viewFor', () => {
  it('includes my hand and my legal actions', () => {
    const v = viewFor(state, 0);
    expect(v.hand).toEqual(state.players[0].hand);
    expect(v.legalActions).toEqual(legalActions(state, 0));
  });

  it('NEVER exposes opponent hands or the wall', () => {
    const v = viewFor(state, 1);
    const json = JSON.parse(JSON.stringify(v));
    for (const opp of json.opponents) {
      expect(opp.hand).toBeUndefined();
      expect(typeof opp.handCount).toBe('number');
    }
    expect(json.tiles).toBeUndefined();
    expect(json.wallFront).toBeUndefined();
    expect(json.wallBack).toBeUndefined();
    expect(json.seed).toBeUndefined();
    expect(typeof json.wallCount).toBe('number');
  });

  it('leaks no opponent tile anywhere in the serialized view', () => {
    // The blunt instrument: for every seat, take every concealed tile the other
    // three hold and prove none of them appear anywhere in my view's JSON that
    // is not accounted for by my own hand, melds, discards or flowers.
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const v = viewFor(state, seat);
      const json = JSON.parse(JSON.stringify(v));
      // Everything legitimately visible to me, as a multiset.
      const visible = [
        ...json.hand,
        ...json.melds.flatMap((m: { tiles: string[] }) => m.tiles),
        ...json.discards, ...json.flowers,
        ...json.opponents.flatMap((o: { melds: { tiles: string[] }[]; discards: string[]; flowers: string[] }) =>
          [...o.melds.flatMap((m) => m.tiles), ...o.discards, ...o.flowers]),
      ].length;
      // Count every tile-looking string in the payload.
      const tileLike = JSON.stringify(json).match(/"(?:[1-9][wtb]|w[eswn]|d[rgw]|f[1-8])"/g) ?? [];
      // legalActions also names tiles I hold, so allow those too.
      const inActions = JSON.stringify(json.legalActions).match(
        /"(?:[1-9][wtb]|w[eswn]|d[rgw]|f[1-8])"/g,
      ) ?? [];
      const lastDiscard = json.lastDiscard ? 1 : 0;
      expect(
        tileLike.length,
        `seat ${seat}: view contains ${tileLike.length} tile strings but only ` +
          `${visible + inActions.length + lastDiscard} are accounted for`,
      ).toBeLessThanOrEqual(visible + inActions.length + lastDiscard);
    }
  });

  it('orders opponents clockwise from me', () => {
    const v = viewFor(state, 2);
    expect(v.opponents.map((o) => o.seat)).toEqual([3, 0, 1]);
  });

  it('gives every seat a distinct clockwise ordering', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const v = viewFor(state, seat);
      expect(v.seat).toBe(seat);
      expect(v.opponents.map((o) => o.seat)).toEqual([1, 2, 3].map((i) => (seat + i) % 4));
    }
  });

  it("property: for every seat, the view accounts for exactly the table's concealed tiles", () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const v = viewFor(state, seat);
      const total = v.hand.length + v.opponents.reduce((n, o) => n + o.handCount, 0);
      expect(total).toBe(state.players.reduce((n, p) => n + p.hand.length, 0));
    }
  });

  it('reports the wall as a count, not as tiles', () => {
    const v = viewFor(state, 0);
    expect(v.wallCount).toBe(state.wallBack - state.wallFront + 1);
  });

  it('hands out copies, so a consumer cannot mutate engine state through it', () => {
    const v = viewFor(state, 0);
    const before = [...state.players[0].hand];
    v.hand.push('f1');
    v.melds.push({ type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 1 });
    expect(state.players[0].hand).toEqual(before);
    expect(state.players[0].melds).toEqual([]);
  });

  it('reveals the result to everyone once the hand is finished', () => {
    let s: GameState = newHand({ seed: 4, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let guard = 0;
    while (s.phase !== 'finished') {
      expect(guard++).toBeLessThan(2000);
      const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const options = legalActions(s, seat);
      s = applyAction(s, options.find((a) => a.type === 'pass') ?? options[0]!);
    }
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(viewFor(s, seat).result).toEqual(s.result);
      expect(viewFor(s, seat).legalActions).toEqual([]);
    }
  });

  it('carries the claim window so a client knows it may respond', () => {
    let s: GameState = newHand({ seed: 12, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let guard = 0;
    while (s.phase !== 'awaiting-claims' && s.phase !== 'finished') {
      expect(guard++).toBeLessThan(2000);
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
    }
    if (s.phase === 'awaiting-claims') {
      const claimant = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const v = viewFor(s, claimant);
      expect(v.phase).toBe('awaiting-claims');
      expect(v.legalActions.length).toBeGreaterThan(0);
      expect(v.lastDiscard).not.toBeNull();
    }
  });
});
