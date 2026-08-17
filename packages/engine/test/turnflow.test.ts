import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand, IllegalActionError } from '../src/game.js';
import type { GameState } from '../src/game.js';
import { isFlower } from '../src/tiles.js';

function start(): GameState {
  return newHand({ seed: 9, dealer: 0, dealerStreak: 0, roundWind: 'E' });
}

/** Every tile that exists somewhere in the state. Must always be 144. */
function totalTiles(s: GameState): number {
  const held = s.players.reduce(
    (n, p) => n + p.hand.length + p.flowers.length + p.discards.length
      + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
    0,
  );
  return held + (s.wallBack - s.wallFront + 1);
}

describe('discard and auto-draw', () => {
  it('moves the tile to discards and draws for the next seat', () => {
    const s0 = start();
    const tile = s0.players[0].hand[0]!;
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile });
    expect(s1.players[0].discards).toEqual([tile]);
    expect(s1.players[0].hand).toHaveLength(16);
    expect(s1.turn).toBe(1);
    expect(s1.players[1].hand).toHaveLength(17);
    expect(s1.phase).toBe('awaiting-discard');
    expect(s0.players[0].hand).toHaveLength(17); // input state untouched
  });
  it('does not mutate the state it was given', () => {
    const s0 = start();
    const before = JSON.stringify(s0);
    applyAction(s0, { type: 'discard', seat: 0, tile: s0.players[0].hand[0]! });
    expect(JSON.stringify(s0)).toBe(before);
  });
  it('rejects discarding out of turn or a tile not in hand', () => {
    const s0 = start();
    expect(() => applyAction(s0, { type: 'discard', seat: 1, tile: s0.players[1].hand[0]! }))
      .toThrow(IllegalActionError);
  });
  it('rejects discarding a tile the seat does not hold', () => {
    const s0 = start();
    const notHeld = (['1w', '2w', '3w', '4w', '5w'] as const)
      .find((t) => !s0.players[0].hand.includes(t))!;
    expect(() => applyAction(s0, { type: 'discard', seat: 0, tile: notHeld }))
      .toThrow(IllegalActionError);
  });
  it('names the seat, the tile and the phase when it rejects an action', () => {
    const s0 = start();
    let caught: unknown;
    try {
      applyAction(s0, { type: 'discard', seat: 1, tile: s0.players[1].hand[0]! });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(IllegalActionError);
    const message = (caught as Error).message;
    for (const fragment of ['seat 1', 'turn', 'awaiting-discard']) {
      expect(message, `error message did not mention ${fragment}: ${message}`)
        .toContain(fragment);
    }
  });
  it('never leaves a flower sitting in a hand', () => {
    let s = start();
    for (let i = 0; i < 40 && s.phase !== 'finished'; i++) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
      for (const p of s.players) {
        expect(p.hand.some(isFlower), `flower left in hand: ${p.hand.join(',')}`).toBe(false);
      }
    }
  });
  it('conserves 144 tiles across many plays', () => {
    let s = start();
    for (let i = 0; i < 40 && s.phase !== 'finished'; i++) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
      expect(totalTiles(s), `tile count broke on step ${i}`).toBe(144);
    }
  });
});

describe('legalActions', () => {
  it('offers discards only to the turn seat', () => {
    const s0 = start();
    expect(legalActions(s0, 0).some((a) => a.type === 'discard')).toBe(true);
    expect(legalActions(s0, 1)).toEqual([]);
  });
  it('offers one discard per distinct tile held, not per duplicate', () => {
    const s0 = start();
    const discards = legalActions(s0, 0).filter((a) => a.type === 'discard');
    expect(discards).toHaveLength(new Set(s0.players[0].hand).size);
  });
  it('every offered action is actually applicable', () => {
    const s0 = start();
    for (const action of legalActions(s0, 0)) {
      expect(() => applyAction(s0, action), `legalActions offered an illegal ${action.type}`)
        .not.toThrow();
    }
  });
  it('offers nothing at all once the hand is finished', () => {
    let s = start();
    let guard = 0;
    while (s.phase !== 'finished' && guard++ < 500) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
    }
    expect(s.phase).toBe('finished');
    for (const seat of [0, 1, 2, 3] as const) expect(legalActions(s, seat)).toEqual([]);
    expect(() => applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! }))
      .toThrow(IllegalActionError);
  });
});

describe('exhaustive draw', () => {
  it('finishes the hand when the wall reaches its 16-tile floor', () => {
    let s = start();
    let guard = 0;
    while (s.phase !== 'finished' && guard++ < 500) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
    }
    expect(s.phase).toBe('finished');
    expect(s.wallBack - s.wallFront + 1).toBeLessThanOrEqual(16);
    expect(totalTiles(s)).toBe(144);
  });
});
