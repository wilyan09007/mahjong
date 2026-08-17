/**
 * The engine's ONLY source of randomness.
 *
 * `Math.random()` is banned everywhere in this package: a hand must be exactly
 * reproducible from its seed so that a bug reported as "seed 8231 crashed on
 * step 47" can be replayed byte-for-byte. Every shuffle goes through
 * `mulberry32`, which is a small, fast, fully deterministic PRNG.
 */

import { FULL_TILE_SET, type TileKind } from './tiles.js';

/**
 * mulberry32 — 32-bit state, period 2^32, uniform enough for shuffling tiles.
 * Returns a closure so callers hold their own independent stream; two closures
 * built from the same seed emit identical sequences.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic shuffled copy of all 144 tiles (Fisher-Yates).
 *
 * The returned array is the hand's wall for its entire life and is never
 * mutated after creation — drawing moves the `wallFront` / `wallBack` indexes
 * in `GameState` instead. That is what makes tile conservation checkable: the
 * 144 tiles are always accounted for as "in the wall between the two indexes"
 * plus "in somebody's hand, melds, flowers, or discards".
 *
 * It is also a fresh copy every call, so no caller can corrupt `FULL_TILE_SET`.
 */
export function buildWall(seed: number): TileKind[] {
  const tiles = [...FULL_TILE_SET];
  const rng = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  return tiles;
}
