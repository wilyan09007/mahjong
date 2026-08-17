/**
 * Win-shape detection over a 34-slot count array.
 *
 * A Taiwanese win is N sets + exactly one pair, where a set is a pung (three
 * identical) or a run (three consecutive in one suit). Kongs never appear here:
 * a kong lives in `melds` and its replacement draw keeps the concealed hand at
 * a 3n+2 length, so this module only ever reasons about 3-tile sets.
 *
 * Concealed-hand lengths that can win: 2, 5, 8, 11, 14, 17 (17 with no melds,
 * three fewer per meld). Anything else is rejected outright.
 */

import {
  NON_FLOWER_KINDS, kindIndex, type TileKind,
} from './tiles.js';

export interface WinDecomposition {
  sets: TileKind[][];
  pair: TileKind;
}

/**
 * Guard against a pathological hand exploding the enumeration in
 * `decomposeWinAll`. Real 17-tile hands produce single digits of readings; if
 * this ever trips it is an engine bug worth seeing, not a case to silently
 * truncate — so it throws with the hand attached.
 */
const MAX_DECOMPOSITIONS = 4096;

function toCounts(tiles: TileKind[]): number[] {
  const counts = new Array<number>(34).fill(0);
  for (const t of tiles) counts[kindIndex(t)]!++;
  return counts;
}

function kindAt(i: number): TileKind {
  return NON_FLOWER_KINDS[i]!;
}

/**
 * A run may start at suit ranks 1..7 only. Index layout is 0-8 = 1w-9w,
 * 9-17 = 1t-9t, 18-26 = 1b-9b, 27+ = honors — so `i % 9 <= 6` keeps the run
 * inside one suit and `i < 27` keeps honors out of it. Without the modulo test
 * a "run" could wrap 8b/9b into 1w.
 */
function canStartRun(i: number): boolean {
  return i < 27 && i % 9 <= 6;
}

/**
 * Depth-first set removal, always attacking the lowest remaining kind first.
 * Because the lowest kind must be consumed by *some* set, and it can only be
 * consumed as a pung or as the low end of a run, those two branches are
 * exhaustive — and processing indexes in ascending order means each distinct
 * decomposition is reached by exactly one path (no permutation duplicates).
 *
 * Returns on the first success; `sets` is filled unwind-order and reversed by
 * the caller.
 */
function removeSets(counts: number[], sets: TileKind[][] | null): boolean {
  const i = counts.findIndex((c) => c > 0);
  if (i === -1) return true;
  if (counts[i]! >= 3) {
    counts[i]! -= 3;
    if (removeSets(counts, sets)) {
      sets?.push([kindAt(i), kindAt(i), kindAt(i)]);
      return true;
    }
    counts[i]! += 3;
  }
  if (canStartRun(i) && counts[i + 1]! > 0 && counts[i + 2]! > 0) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    if (removeSets(counts, sets)) {
      sets?.push([kindAt(i), kindAt(i + 1), kindAt(i + 2)]);
      return true;
    }
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
  return false;
}

/** Exhaustive variant of `removeSets`: collects every complete decomposition. */
function enumerateSets(counts: number[], acc: TileKind[][], out: TileKind[][][]): void {
  if (out.length > MAX_DECOMPOSITIONS) {
    throw new Error(
      `win decomposition exploded past ${MAX_DECOMPOSITIONS} readings — this is ` +
        `an engine bug; counts=${JSON.stringify(counts)}`,
    );
  }
  const i = counts.findIndex((c) => c > 0);
  if (i === -1) {
    out.push(acc.map((s) => [...s]));
    return;
  }
  if (counts[i]! >= 3) {
    counts[i]! -= 3;
    acc.push([kindAt(i), kindAt(i), kindAt(i)]);
    enumerateSets(counts, acc, out);
    acc.pop();
    counts[i]! += 3;
  }
  if (canStartRun(i) && counts[i + 1]! > 0 && counts[i + 2]! > 0) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    acc.push([kindAt(i), kindAt(i + 1), kindAt(i + 2)]);
    enumerateSets(counts, acc, out);
    acc.pop();
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
}

/**
 * One valid `{ sets, pair }`, or null. Pairs are tried in `kindIndex` order and
 * the first that yields a complete decomposition wins, so the result is stable
 * for a given input. This is the fast path used by `isWinningHand` and
 * `winningTiles`; scoring uses `decomposeWinAll` instead.
 */
export function decomposeWin(tiles: TileKind[]): WinDecomposition | null {
  if (tiles.length % 3 !== 2) return null;
  const counts = toCounts(tiles);
  for (let p = 0; p < 34; p++) {
    if (counts[p]! < 2) continue;
    counts[p]! -= 2;
    const sets: TileKind[][] = [];
    if (removeSets(counts, sets)) {
      counts[p]! += 2;
      return { sets: sets.reverse(), pair: kindAt(p) };
    }
    counts[p]! += 2;
  }
  return null;
}

/**
 * EVERY valid reading of the same tiles, ordered so that `[0]` is exactly what
 * `decomposeWin` returns.
 *
 * This exists because scoring is not decomposition-independent. `1t1t1t 2t2t2t
 * 3t3t3t` is simultaneously three pungs (碰碰胡, 4 tai) and three runs (a
 * 平胡 candidate, 2 tai); `111 222 333` in one suit is the classic case.
 * Taiwanese practice scores the winner's best reading, so `scoreTaiwaneseHand`
 * evaluates all of these and keeps the highest total. Committing to the first
 * reading — as a single-decomposition engine must — silently underpays real
 * hands, which is a wrong answer, not a simplification.
 */
export function decomposeWinAll(tiles: TileKind[]): WinDecomposition[] {
  if (tiles.length % 3 !== 2) return [];
  const counts = toCounts(tiles);
  const results: WinDecomposition[] = [];
  for (let p = 0; p < 34; p++) {
    if (counts[p]! < 2) continue;
    counts[p]! -= 2;
    const out: TileKind[][][] = [];
    enumerateSets(counts, [], out);
    for (const sets of out) results.push({ sets, pair: kindAt(p) });
    counts[p]! += 2;
  }
  return results;
}

export function isWinningHand(tiles: TileKind[]): boolean {
  return decomposeWin(tiles) !== null;
}

/**
 * For a 3n+1 hand, the kinds that complete it. Also the basis of the 獨聽
 * single-wait tai: exactly one entry means the winner was waiting on one tile.
 */
export function winningTiles(tiles: TileKind[]): TileKind[] {
  if (tiles.length % 3 !== 1) return [];
  return NON_FLOWER_KINDS.filter((k) => isWinningHand([...tiles, k]));
}
