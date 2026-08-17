import { describe, expect, it } from 'vitest';
import { shanten16 } from '../src/shanten.js';
import { isWinningHand, mulberry32, winningTiles, NON_FLOWER_KINDS } from '@mahjong/engine';
import type { TileKind } from '@mahjong/engine';

/**
 * `shanten16` answers "how many effective draws from a win?" for a Taiwanese
 * hand: -1 winning, 0 tenpai (waiting), n > 0 otherwise.
 *
 * The contract that matters is the tenpai boundary, because that is what the
 * bot uses to decide everything. `winningTiles` is exact ground truth, so the
 * property test below checks agreement against it over thousands of real
 * random hands rather than over hand-picked examples.
 */

describe('shanten16', () => {
  it('-1 for a winning 17-tile hand', () => {
    const win: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we',
    ];
    expect(shanten16(win, 0)).toBe(-1);
  });

  it('0 for tenpai, agreeing with winningTiles', () => {
    const tenpai: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we',
    ];
    expect(shanten16(tenpai, 0)).toBe(0);
    expect(winningTiles(tenpai).length).toBeGreaterThan(0);
  });

  it('1 for one-away', () => {
    const oneAway: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'we', 'ws',
    ];
    expect(shanten16(oneAway, 0)).toBe(1);
  });

  it('respects melds (shorter concealed hands)', () => {
    // 2 melds out: concealed 10 tiles, tenpai on a pair wait
    expect(shanten16(['9b', '1t', '1t', '1t', '2t', '3t', '4t', '5t', '6t', '7t'], 2)).toBe(0);
  });

  it('grows as a hand gets further from done', () => {
    // Same 16 tiles, progressively wrecked: every step must be no closer.
    const base: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we',
    ];
    const wrecked: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '2b', '5b', 'dr', 'dg', 'dw', 'we',
    ];
    expect(shanten16(base, 0)).toBeLessThan(shanten16(wrecked, 0));
  });

  it('a fully disconnected hand is far from tenpai', () => {
    const junk: TileKind[] = [
      '1w', '4w', '7w', '1t', '4t', '7t', '1b', '4b',
      '7b', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
    ];
    expect(shanten16(junk, 0)).toBeGreaterThan(2);
  });

  it('property: 1500 random hands never disagree with winningTiles', () => {
    // Uniformly random 16-tile hands are essentially never tenpai — the first
    // version of this test asserted otherwise and found zero across 2000 draws.
    // It is still worth running: it is the only check that the NON-tenpai
    // branch never claims a wait that isn't there, over hands no fixture would
    // think to write.
    const rng = mulberry32(20260817);
    const pool: TileKind[] = NON_FLOWER_KINDS.flatMap((k) => [k, k, k, k]);

    for (let trial = 0; trial < 1500; trial++) {
      const hand = drawWithoutReplacement(pool, 16, rng);
      const s = shanten16(hand, 0);
      expect(s, `shanten below -1 for ${hand.join(' ')}`).toBeGreaterThanOrEqual(-1);
      const waits = winningTiles(hand);
      expect(
        s === 0,
        `shanten16=${s} but winningTiles=[${waits.join(',')}] for ${hand.join(' ')}`,
      ).toBe(waits.length > 0);
    }
  });

  it('property: 800 CONSTRUCTED tenpai hands all read as 0', () => {
    // Built rather than drawn, because random hands never land here. A winning
    // hand minus any one tile is tenpai by construction — the removed tile
    // always completes it again — so this exercises the boundary directly.
    const rng = mulberry32(31415);
    let built = 0;

    for (let trial = 0; trial < 800; trial++) {
      const win = randomWinningHand(rng, 5);
      if (!win) continue;
      built++;

      expect(isWinningHand(win), `constructed hand does not win: ${win.join(' ')}`).toBe(true);
      expect(shanten16(win, 0), `winning hand not -1: ${win.join(' ')}`).toBe(-1);

      const drop = Math.floor(rng() * win.length);
      const tenpai = win.filter((_, i) => i !== drop);
      const waits = winningTiles(tenpai);
      expect(waits.length, `no wait for a win minus one tile: ${tenpai.join(' ')}`)
        .toBeGreaterThan(0);
      expect(
        shanten16(tenpai, 0),
        `constructed tenpai read as non-tenpai: ${tenpai.join(' ')} waits=[${waits.join(',')}]`,
      ).toBe(0);
    }
    expect(built, 'the hand builder never produced a valid winning hand').toBeGreaterThan(700);
  });

  it('property: constructed hands with melds agree at every meld count', () => {
    const rng = mulberry32(555);
    for (const meldCount of [1, 2, 3, 4] as const) {
      let built = 0;
      for (let trial = 0; trial < 150; trial++) {
        const win = randomWinningHand(rng, 5 - meldCount);
        if (!win) continue;
        built++;
        expect(shanten16(win, meldCount), `melds=${meldCount} win not -1: ${win.join(' ')}`)
          .toBe(-1);

        // Hoist the index: calling rng() inside the filter callback re-rolls it
        // per element and can drop nothing at all, handing a complete winning
        // hand to an assertion that expects tenpai.
        const drop = Math.floor(rng() * win.length);
        const tenpai = win.filter((_, i) => i !== drop);
        expect(tenpai).toHaveLength(win.length - 1);
        expect(
          shanten16(tenpai, meldCount),
          `melds=${meldCount} tenpai misread: ${tenpai.join(' ')}`,
        ).toBe(0);
        expect(winningTiles(tenpai).length).toBeGreaterThan(0);
      }
      expect(built, `builder failed at meldCount ${meldCount}`).toBeGreaterThan(100);
    }
  });

  it('property: wrecking a tenpai hand always moves it away from tenpai', () => {
    const rng = mulberry32(2718);
    let checked = 0;
    for (let trial = 0; trial < 400; trial++) {
      const win = randomWinningHand(rng, 5);
      if (!win) continue;
      const tenpai = win.slice(0, 16);
      if (winningTiles(tenpai).length === 0) continue;

      // Replace a tile with an unrelated honor; the result cannot be closer.
      const wrecked = [...tenpai];
      wrecked[Math.floor(rng() * wrecked.length)] = 'wn';
      expect(shanten16(wrecked, 0)).toBeGreaterThanOrEqual(shanten16(tenpai, 0));
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
});

/** Draw `n` tiles without replacement, so the 4-copies-per-kind limit holds. */
function drawWithoutReplacement(pool: TileKind[], n: number, rng: () => number): TileKind[] {
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag.slice(0, n);
}

/**
 * A real winning hand: `sets` sets plus one pair, respecting four copies per
 * kind. Returns null if the random walk painted itself into a corner, which the
 * callers count and assert stays rare.
 */
function randomWinningHand(rng: () => number, sets: number): TileKind[] | null {
  const counts = new Array<number>(34).fill(0);
  const tiles: TileKind[] = [];
  const kindAt = (i: number): TileKind => NON_FLOWER_KINDS[i]!;

  for (let s = 0; s < sets; s++) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      if (rng() < 0.4) {
        const i = Math.floor(rng() * 34);
        if (counts[i]! + 3 <= 4) {
          counts[i]! += 3;
          tiles.push(kindAt(i), kindAt(i), kindAt(i));
          placed = true;
        }
      } else {
        const i = Math.floor(rng() * 3) * 9 + Math.floor(rng() * 7);
        if (counts[i]! < 4 && counts[i + 1]! < 4 && counts[i + 2]! < 4) {
          counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
          tiles.push(kindAt(i), kindAt(i + 1), kindAt(i + 2));
          placed = true;
        }
      }
    }
    if (!placed) return null;
  }

  for (let attempt = 0; attempt < 80; attempt++) {
    const i = Math.floor(rng() * 34);
    if (counts[i]! + 2 <= 4) {
      counts[i]! += 2;
      tiles.push(kindAt(i), kindAt(i));
      return tiles;
    }
  }
  return null;
}
