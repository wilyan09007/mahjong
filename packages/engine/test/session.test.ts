import { describe, expect, it } from 'vitest';
import { nextHandParams, isSessionOver, newSession } from '../src/session.js';
import type { HandResult } from '../src/game.js';
import type { SessionParams } from '../src/session.js';

const win = (winner: 0 | 1 | 2 | 3): HandResult => ({
  type: 'win', winner, by: 'discard', discarder: 3, winTile: '1w', tai: 1, breakdown: [],
  payments: [0, 0, 0, 0], winningHand: { concealed: [], melds: [], flowers: [] },
});

describe('session rotation', () => {
  it('dealer win keeps the deal and grows the streak', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 0, roundWind: 'E', handsPlayed: 3, roundsCompleted: 0 }, win(1),
    );
    expect(next).toEqual({ dealer: 1, dealerStreak: 1, roundWind: 'E', handsPlayed: 4, roundsCompleted: 0 });
  });
  it('non-dealer win passes the deal', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 2, roundWind: 'E', handsPlayed: 5, roundsCompleted: 0 }, win(0),
    );
    expect(next).toEqual({ dealer: 2, dealerStreak: 0, roundWind: 'E', handsPlayed: 6, roundsCompleted: 0 });
  });
  it('exhaustive draw keeps the deal', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 1, roundsCompleted: 0 },
      { type: 'draw-exhausted' },
    );
    expect(next.dealer).toBe(3);
    expect(next.dealerStreak).toBe(1);
  });
  it('round wind advances and a lap is counted when the deal passes seat 3 → 0', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 7, roundsCompleted: 0 }, win(0),
    );
    expect(next).toEqual({
      dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 8, roundsCompleted: 1,
    });
  });
  it('the round wind does not advance on any other handover', () => {
    for (const dealer of [0, 1, 2] as const) {
      const next = nextHandParams(
        { dealer, dealerStreak: 0, roundWind: 'E', handsPlayed: 0, roundsCompleted: 0 },
        win(((dealer + 1) % 4) as 0 | 1 | 2 | 3),
      );
      expect(next.roundWind, `dealer ${dealer} should not have advanced the wind`).toBe('E');
      expect(next.roundsCompleted, `dealer ${dealer} should not have completed a lap`).toBe(0);
    }
  });
  it('walks E → S → W → N across four laps', () => {
    let p: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0, roundsCompleted: 0 };
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
    const start: SessionParams = { dealer: 2, dealerStreak: 4, roundWind: 'W', handsPlayed: 30, roundsCompleted: 0 };
    expect(nextHandParams(start, win(2)).handsPlayed).toBe(31);
    expect(nextHandParams(start, win(0)).handsPlayed).toBe(31);
    expect(nextHandParams(start, { type: 'draw-exhausted' }).handsPlayed).toBe(31);
  });
});

describe('session end', () => {
  it('session ends after the configured rounds', () => {
    expect(isSessionOver(newSession(), 1)).toBe(false);
    expect(isSessionOver(
      { dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 9, roundsCompleted: 1 }, 1,
    )).toBe(true);
  });

  it('a fresh session starts in the East round with nothing completed', () => {
    expect(newSession()).toEqual({
      dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0, roundsCompleted: 0,
    });
    expect(newSession(2).dealer).toBe(2);
  });

  it('supports a full 全莊 four-round session, which the round wind alone cannot', () => {
    // After four laps the wind has wrapped back to 'E' — identical to a fresh
    // session. Only the explicit counter can tell them apart, which is the
    // whole reason it exists.
    let p = newSession();
    for (let lap = 0; lap < 4; lap++) {
      for (let i = 0; i < 4; i++) {
        p = nextHandParams(p, win(((p.dealer + 1) % 4) as 0 | 1 | 2 | 3));
      }
      expect(p.roundsCompleted).toBe(lap + 1);
    }
    expect(p.roundWind).toBe('E');     // wrapped
    expect(p.roundsCompleted).toBe(4); // but the session is unmistakably over
    expect(isSessionOver(p, 4)).toBe(true);
    expect(isSessionOver(p, 1)).toBe(true);
    expect(isSessionOver(newSession(), 4)).toBe(false);
  });

  it('a long dealer streak never falsely completes a round', () => {
    // Ten dealer repeats: many hands, zero laps.
    let p = newSession();
    for (let i = 0; i < 10; i++) p = nextHandParams(p, win(p.dealer));
    expect(p.handsPlayed).toBe(10);
    expect(p.roundsCompleted).toBe(0);
    expect(isSessionOver(p, 1)).toBe(false);
  });

  it('rejects a round count outside 1-4', () => {
    const p = newSession();
    expect(() => isSessionOver(p, 0)).toThrow(/1-4/);
    expect(() => isSessionOver(p, 5)).toThrow(/1-4/);
    expect(() => isSessionOver(p, 1.5)).toThrow(/1-4/);
  });
});
