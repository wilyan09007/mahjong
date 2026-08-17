import { describe, expect, it } from 'vitest';
import { decomposeWin, decomposeWinAll, isWinningHand, winningTiles } from '../src/win.js';
import type { TileKind } from '../src/tiles.js';

// Full 17-tile Taiwanese winning hand: 5 sets + pair.
const WIN_17: TileKind[] = [
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
  '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we',
];

describe('isWinningHand', () => {
  it('accepts 5 sets + pair (17 tiles)', () => {
    expect(isWinningHand(WIN_17)).toBe(true);
  });
  it('accepts hands shortened by melds (8 tiles = 2 sets + pair)', () => {
    expect(isWinningHand(['2b', '3b', '4b', '7t', '7t', '7t', 'dg', 'dg'])).toBe(true);
  });
  it('rejects a near-miss', () => {
    const nearMiss = [...WIN_17.slice(0, 16), '9b'] as TileKind[];
    expect(isWinningHand(nearMiss)).toBe(false);
  });
  it('rejects two pairs / wrong shape', () => {
    expect(isWinningHand(['1w', '1w', '2w', '2w', '5t', '5t', '5t', '9b'])).toBe(false);
  });
  it('rejects hands whose length is not 3n+2', () => {
    expect(isWinningHand(WIN_17.slice(0, 16))).toBe(false);
    expect(isWinningHand(WIN_17.slice(0, 15))).toBe(false);
    expect(isWinningHand([])).toBe(false);
  });
  it('accepts a bare pair (the 5-melds-out shape)', () => {
    expect(isWinningHand(['dg', 'dg'])).toBe(true);
  });
  it('never lets a run cross a suit boundary', () => {
    // 8b 9b 1w is three consecutive kindIndexes but not a run.
    expect(isWinningHand(['8b', '9b', '1w', 'dr', 'dr'])).toBe(false);
  });
});

describe('decomposeWin', () => {
  it('returns sets and the pair', () => {
    const d = decomposeWin(WIN_17);
    expect(d).not.toBeNull();
    expect(d!.pair).toBe('we');
    expect(d!.sets).toHaveLength(5);
  });
  it('returns a decomposition that actually spends every tile', () => {
    const d = decomposeWin(WIN_17)!;
    const spent = [...d.sets.flat(), d.pair, d.pair].sort();
    expect(spent).toEqual([...WIN_17].sort());
  });
  it('returns null for non-winning tiles', () => {
    expect(decomposeWin(['1w', '1w', '1w', '2t', '3t'])).toBeNull();
  });
});

describe('decomposeWinAll', () => {
  it('finds both readings of a hand that is either three pungs or three runs', () => {
    const ambiguous: TileKind[] = [
      '1t', '1t', '1t', '2t', '2t', '2t', '3t', '3t', '3t', '9b', '9b',
    ];
    const all = decomposeWinAll(ambiguous);
    expect(all).toHaveLength(2);
    const shapes = all.map((d) =>
      d.sets.every((s) => s[0] === s[1]) ? 'pungs' : 'runs',
    );
    expect(new Set(shapes)).toEqual(new Set(['pungs', 'runs']));
    for (const d of all) {
      expect(d.pair).toBe('9b');
      const spent = [...d.sets.flat(), d.pair, d.pair].sort();
      expect(spent).toEqual([...ambiguous].sort());
    }
  });
  it('agrees with decomposeWin on the first reading', () => {
    expect(decomposeWinAll(WIN_17)[0]).toEqual(decomposeWin(WIN_17));
  });
  it('returns an empty list for non-winning tiles', () => {
    expect(decomposeWinAll(['1w', '1w', '1w', '2t', '3t'])).toEqual([]);
  });
  it('every reading of a real winning hand spends exactly the given tiles', () => {
    const all = decomposeWinAll(WIN_17);
    expect(all.length).toBeGreaterThan(0);
    for (const d of all) {
      expect([...d.sets.flat(), d.pair, d.pair].sort()).toEqual([...WIN_17].sort());
    }
  });
});

describe('winningTiles', () => {
  it('finds a two-sided wait', () => {
    // 2 sets done + pair done + 4w5w waiting on 3w/6w (7-tile hand = 2 melds out)
    const waits = winningTiles(['4w', '5w', '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we']);
    expect(waits).toEqual(['3w', '6w']);
  });
  it('finds a pair wait', () => {
    const waits = winningTiles(['9b', '1t', '1t', '1t', '2t', '3t', '4t']);
    expect(waits).toEqual(['9b']);
  });
  it('returns nothing for a hand of the wrong length', () => {
    expect(winningTiles(WIN_17)).toEqual([]);
  });
  it('every reported wait really does complete the hand', () => {
    const tenpai: TileKind[] = ['4w', '5w', '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we'];
    for (const w of winningTiles(tenpai)) {
      expect(isWinningHand([...tenpai, w]), `${w} was reported as a wait but does not win`)
        .toBe(true);
    }
  });
  it('reports no waits for a hand that cannot be one tile away', () => {
    expect(winningTiles(['1w', '4w', '7w', '1t'])).toEqual([]);
  });
});
