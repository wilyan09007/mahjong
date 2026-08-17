import { describe, expect, it } from 'vitest';
import { nextHandParams, isSessionOver, roundsCompleted } from '../src/session.js';
import type { HandResult } from '../src/game.js';
import type { SessionParams } from '../src/session.js';

const win = (winner: 0 | 1 | 2 | 3): HandResult => ({
  type: 'win', winner, by: 'discard', discarder: 3, winTile: '1w', tai: 1, breakdown: [],
  payments: [0, 0, 0, 0], winningHand: { concealed: [], melds: [], flowers: [] },
});

describe('session rotation', () => {
  it('dealer win keeps the deal and grows the streak', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 0, roundWind: 'E', handsPlayed: 3 }, win(1),
    );
    expect(next).toEqual({ dealer: 1, dealerStreak: 1, roundWind: 'E', handsPlayed: 4 });
  });
  it('non-dealer win passes the deal', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 2, roundWind: 'E', handsPlayed: 5 }, win(0),
    );
    expect(next).toEqual({ dealer: 2, dealerStreak: 0, roundWind: 'E', handsPlayed: 6 });
  });
  it('exhaustive draw keeps the deal', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 1 },
      { type: 'draw-exhausted' },
    );
    expect(next.dealer).toBe(3);
    expect(next.dealerStreak).toBe(1);
  });
  it('round wind advances when the deal passes seat 3 → 0', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 7 }, win(0),
    );
    expect(next).toEqual({ dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 8 });
  });
  it('the round wind does not advance on any other handover', () => {
    for (const dealer of [0, 1, 2] as const) {
      const next = nextHandParams(
        { dealer, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 }, win(((dealer + 1) % 4) as 0 | 1 | 2 | 3),
      );
      expect(next.roundWind, `dealer ${dealer} should not have advanced the wind`).toBe('E');
    }
  });
  it('walks E → S → W → N across four laps', () => {
    let p: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    const seen: string[] = [p.roundWind];
    for (let lap = 0; lap < 3; lap++) {
      for (let i = 0; i < 4; i++) {
        p = nextHandParams(p, win(((p.dealer + 1) % 4) as 0 | 1 | 2 | 3));
      }
      seen.push(p.roundWind);
    }
    expect(seen).toEqual(['E', 'S', 'W', 'N']);
    expect(p.handsPlayed).toBe(12);
    expect(p.dealer).toBe(0);
  });
  it('always counts the hand, however it ended', () => {
    const start: SessionParams = { dealer: 2, dealerStreak: 4, roundWind: 'W', handsPlayed: 30 };
    expect(nextHandParams(start, win(2)).handsPlayed).toBe(31);
    expect(nextHandParams(start, win(0)).handsPlayed).toBe(31);
    expect(nextHandParams(start, { type: 'draw-exhausted' }).handsPlayed).toBe(31);
  });
});

describe('session end', () => {
  it('session ends after the configured rounds', () => {
    expect(isSessionOver({ dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 }, 1)).toBe(false);
    expect(isSessionOver({ dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 9 }, 1)).toBe(true);
  });
  it('counts completed laps off the round wind', () => {
    expect(roundsCompleted({ dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 })).toBe(0);
    expect(roundsCompleted({ dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 0 })).toBe(1);
    expect(roundsCompleted({ dealer: 0, dealerStreak: 0, roundWind: 'W', handsPlayed: 0 })).toBe(2);
    expect(roundsCompleted({ dealer: 0, dealerStreak: 0, roundWind: 'N', handsPlayed: 0 })).toBe(3);
  });
  it('refuses a round count it cannot represent, and says why', () => {
    const p: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    // The round wind is the only lap counter and it wraps N→E, so four rounds
    // and zero rounds are the same state. Throwing beats guessing.
    expect(() => isSessionOver(p, 4)).toThrow(/roundsCompleted/);
    expect(() => isSessionOver(p, 0)).toThrow(/1-3/);
    expect(() => isSessionOver(p, 1.5)).toThrow(/1-3/);
  });
});
