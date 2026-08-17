import { describe, expect, it } from 'vitest';
import { buildWall, mulberry32 } from '../src/wall.js';
import { FULL_TILE_SET, sortTiles } from '../src/tiles.js';

describe('wall', () => {
  it('is deterministic per seed', () => {
    expect(buildWall(42)).toEqual(buildWall(42));
    expect(buildWall(42)).not.toEqual(buildWall(43));
  });
  it('is a permutation of the full tile set', () => {
    expect(sortTiles(buildWall(7))).toEqual(sortTiles(FULL_TILE_SET));
  });
  it('is a permutation for every seed sampled across the range', () => {
    const expected = sortTiles(FULL_TILE_SET);
    for (const seed of [0, 1, 2, 999, 123456, 2 ** 31 - 1]) {
      expect(sortTiles(buildWall(seed)), `seed ${seed} produced a non-permutation`)
        .toEqual(expected);
    }
  });
  it('does not hand out a reference to the shared FULL_TILE_SET', () => {
    const wall = buildWall(1);
    expect(wall).not.toBe(FULL_TILE_SET);
    wall[0] = 'f8';
    expect(FULL_TILE_SET).toHaveLength(144);
    expect(sortTiles(FULL_TILE_SET)).toEqual(sortTiles(buildWall(2)));
  });
  it('actually shuffles — the wall is not the identity ordering', () => {
    expect(buildWall(42)).not.toEqual(FULL_TILE_SET);
  });
  it('rng emits values in [0,1) deterministically', () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('rng diverges across seeds and does not get stuck on one value', () => {
    const a = mulberry32(1), b = mulberry32(2);
    const seqA = Array.from({ length: 50 }, a);
    const seqB = Array.from({ length: 50 }, b);
    expect(seqA).not.toEqual(seqB);
    expect(new Set(seqA).size, `rng repeated values: ${seqA.slice(0, 5).join(',')}`)
      .toBeGreaterThan(45);
  });
});
