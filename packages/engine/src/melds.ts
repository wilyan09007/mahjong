/**
 * Meld shape and the pure "can this hand claim this tile?" predicates.
 *
 * Deliberately stateless: nothing here knows whose turn it is, who discarded,
 * or whether a claim would be allowed by priority. That lives in `claims.ts`
 * and `game.ts`. These functions answer only the tile-arithmetic question, so
 * they stay trivially testable and reusable by the bot's hand evaluation.
 */

import {
  isSuitTile, rankOf, suitOf, type Seat, type SuitTileKind, type TileKind,
} from './tiles.js';

export type MeldType = 'chow' | 'pung' | 'kong';

/**
 * `concealed` distinguishes a concealed kong (drawn all four yourself, worth
 * more in scoring) from an exposed one. `claimedFrom` is the seat the claimed
 * tile came from, or null for a fully self-assembled meld — scoring reads both.
 */
export interface Meld {
  type: MeldType;
  tiles: TileKind[];
  concealed: boolean;
  claimedFrom: Seat | null;
}

function count(hand: TileKind[], t: TileKind): number {
  return hand.filter((h) => h === t).length;
}

/** Neighbouring tile in the same suit, or null when it would fall off 1..9. */
function shift(t: SuitTileKind, by: number): SuitTileKind | null {
  const r = rankOf(t)! + by;
  return r >= 1 && r <= 9 ? (`${r}${suitOf(t)!}` as SuitTileKind) : null;
}

/**
 * Every distinct pair from `hand` that completes a run with `tile`.
 *
 * At most three options (tile as high / middle / low end of the run), returned
 * low-run-first. Honors and flowers have no runs, so they return []. The result
 * is naturally deduplicated: a hand holding two 4t still yields one `['4t','5t']`
 * because the three candidate windows are distinct by construction.
 */
export function chowOptions(hand: TileKind[], tile: TileKind): [TileKind, TileKind][] {
  if (!isSuitTile(tile)) return [];
  const options: [TileKind, TileKind][] = [];
  const candidates: [SuitTileKind | null, SuitTileKind | null][] = [
    [shift(tile, -2), shift(tile, -1)],
    [shift(tile, -1), shift(tile, 1)],
    [shift(tile, 1), shift(tile, 2)],
  ];
  for (const [a, b] of candidates) {
    if (a && b && count(hand, a) > 0 && count(hand, b) > 0) options.push([a, b]);
  }
  return options;
}

/** Two in hand + the claimed tile = pung. Three in hand can pung too. */
export function canPung(hand: TileKind[], tile: TileKind): boolean {
  return count(hand, tile) >= 2;
}

/** Three in hand + the claimed tile = exposed kong. */
export function canExposedKong(hand: TileKind[], tile: TileKind): boolean {
  return count(hand, tile) >= 3;
}

/** Kinds held all four times, declarable as a concealed kong on your own turn. */
export function concealedKongOptions(hand: TileKind[]): TileKind[] {
  return [...new Set(hand)].filter((t) => count(hand, t) === 4);
}

/**
 * Kinds where an existing *pung* meld can be upgraded by the 4th tile from hand.
 * Chows can't be upgraded, and an existing kong is already complete — both are
 * filtered out by the `type === 'pung'` test.
 */
export function addedKongOptions(hand: TileKind[], melds: Meld[]): TileKind[] {
  return melds
    .filter((m) => m.type === 'pung' && count(hand, m.tiles[0]!) >= 1)
    .map((m) => m.tiles[0]!);
}
