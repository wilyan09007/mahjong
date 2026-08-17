import { describe, expect, it } from 'vitest';
import {
  FULL_TILE_SET, NON_FLOWER_KINDS, FLOWERS, isFlower, isSuitTile, isHonor,
  rankOf, suitOf, sortTiles, kindIndex, seatWind,
} from '../src/tiles.js';

describe('tile set', () => {
  it('has exactly 144 tiles', () => {
    expect(FULL_TILE_SET).toHaveLength(144);
  });
  it('has 4 copies of each of the 34 non-flower kinds and 1 of each flower', () => {
    for (const kind of NON_FLOWER_KINDS) {
      expect(FULL_TILE_SET.filter((t) => t === kind)).toHaveLength(4);
    }
    for (const f of FLOWERS) {
      expect(FULL_TILE_SET.filter((t) => t === f)).toHaveLength(1);
    }
    expect(NON_FLOWER_KINDS).toHaveLength(34);
  });
});

describe('helpers', () => {
  it('classifies tiles', () => {
    expect(isFlower('f3')).toBe(true);
    expect(isFlower('3w')).toBe(false);
    expect(isSuitTile('9b')).toBe(true);
    expect(isSuitTile('we')).toBe(false);
    expect(isHonor('dr')).toBe(true);
    expect(isHonor('1t')).toBe(false);
  });
  it('classifies every tile in the full set as exactly one of suit/honor/flower', () => {
    for (const t of FULL_TILE_SET) {
      const hits = [isSuitTile(t), isHonor(t), isFlower(t)].filter(Boolean).length;
      expect(hits, `${t} matched ${hits} categories, expected exactly 1`).toBe(1);
    }
  });
  it('extracts rank and suit', () => {
    expect(rankOf('7t')).toBe(7);
    expect(rankOf('wn')).toBeNull();
    expect(suitOf('7t')).toBe('t');
    expect(suitOf('dr')).toBeNull();
  });
  it('sorts suits by w,t,b then rank, then winds, dragons, flowers', () => {
    expect(sortTiles(['dr', '1b', 'we', '9w', '1w', 'f1'])).toEqual([
      '1w', '9w', '1b', 'we', 'dr', 'f1',
    ]);
  });
  it('sorts without mutating its input', () => {
    const input = ['dr', '1w'] as const;
    const copy = [...input];
    sortTiles([...input]);
    expect([...input]).toEqual(copy);
  });
  it('indexes the 34 non-flower kinds stably', () => {
    expect(kindIndex('1w')).toBe(0);
    expect(kindIndex('1t')).toBe(9);
    expect(kindIndex('1b')).toBe(18);
    expect(kindIndex('we')).toBe(27);
    expect(kindIndex('dw')).toBe(33);
    expect(() => kindIndex('f1')).toThrow();
  });
  it('gives every non-flower kind a distinct index in 0..33', () => {
    const seen = new Set(NON_FLOWER_KINDS.map(kindIndex));
    expect(seen.size).toBe(34);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(33);
  });
  it('computes seat winds relative to the dealer', () => {
    expect(seatWind(0, 0)).toBe('E');
    expect(seatWind(1, 0)).toBe('S');
    expect(seatWind(0, 3)).toBe('S');
    expect(seatWind(3, 3)).toBe('E');
  });
  it('gives the four seats four distinct winds for every dealer', () => {
    for (const dealer of [0, 1, 2, 3] as const) {
      const winds = ([0, 1, 2, 3] as const).map((s) => seatWind(s, dealer));
      expect(new Set(winds).size, `dealer ${dealer} produced ${winds.join(',')}`).toBe(4);
      expect(seatWind(dealer, dealer)).toBe('E');
    }
  });
});
