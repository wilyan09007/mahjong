/**
 * The vocabulary every other engine file speaks.
 *
 * Tile codes (used in ALL code and tests):
 *   suits   '1w'…'9w' characters 萬 · '1t'…'9t' dots 筒 · '1b'…'9b' bamboo 條
 *   winds   'we' 東 · 'ws' 南 · 'ww' 西 · 'wn' 北
 *   dragons 'dr' 中 · 'dg' 發 · 'dw' 白
 *   flowers 'f1'…'f8'
 *
 * This module is pure data plus total functions. Anything that cannot answer a
 * question for the input it was given throws — the engine never returns a
 * plausible-looking wrong answer (a silent NaN in the sort comparator would
 * scramble a hand and surface hours later as an impossible win).
 */

export type SuitCode = 'w' | 't' | 'b';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SuitTileKind = `${Rank}${SuitCode}`;
export type WindKind = 'we' | 'ws' | 'ww' | 'wn';
export type DragonKind = 'dr' | 'dg' | 'dw';
export type HonorKind = WindKind | DragonKind;
export type FlowerKind = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8';
export type TileKind = SuitTileKind | HonorKind | FlowerKind;
export type Seat = 0 | 1 | 2 | 3;
export type Wind = 'E' | 'S' | 'W' | 'N';

const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SUITS: SuitCode[] = ['w', 't', 'b'];

export const SUIT_KINDS: SuitTileKind[] = SUITS.flatMap((s) =>
  RANKS.map((r) => `${r}${s}` as SuitTileKind),
);
export const WINDS: WindKind[] = ['we', 'ws', 'ww', 'wn'];
export const DRAGONS: DragonKind[] = ['dr', 'dg', 'dw'];
export const FLOWERS: FlowerKind[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

/** The 34 kinds that appear 4× each. Flowers are excluded: they are singletons. */
export const NON_FLOWER_KINDS: (SuitTileKind | HonorKind)[] = [
  ...SUIT_KINDS, ...WINDS, ...DRAGONS,
];

/** 34 kinds × 4 copies + 8 single flowers = 144. */
export const FULL_TILE_SET: TileKind[] = [
  ...NON_FLOWER_KINDS.flatMap((k) => [k, k, k, k]),
  ...FLOWERS,
];

/** Canonical display order: 萬 → 筒 → 條 → winds → dragons → flowers. */
const ORDER = new Map<TileKind, number>(
  [...NON_FLOWER_KINDS, ...FLOWERS].map((k, i) => [k, i]),
);

/** Sort key, but loud: an unrecognised code is a bug upstream, not a tie. */
function orderOf(t: TileKind): number {
  const i = ORDER.get(t);
  if (i === undefined) {
    throw new Error(
      `unknown tile code ${JSON.stringify(t)} — expected one of 1w-9w, 1t-9t, ` +
        `1b-9b, we/ws/ww/wn, dr/dg/dw, f1-f8`,
    );
  }
  return i;
}

export function isFlower(t: TileKind): t is FlowerKind {
  return t.startsWith('f');
}

export function isSuitTile(t: TileKind): t is SuitTileKind {
  const r = Number(t[0]);
  return r >= 1 && r <= 9;
}

export function isHonor(t: TileKind): t is HonorKind {
  return !isFlower(t) && !isSuitTile(t);
}

export function rankOf(t: TileKind): Rank | null {
  return isSuitTile(t) ? (Number(t[0]) as Rank) : null;
}

export function suitOf(t: TileKind): SuitCode | null {
  return isSuitTile(t) ? (t[1] as SuitCode) : null;
}

/** Non-mutating: callers hold onto hand arrays and must not see them reordered. */
export function sortTiles(ts: TileKind[]): TileKind[] {
  return [...ts].sort((a, b) => orderOf(a) - orderOf(b));
}

/**
 * 0–33 index over `NON_FLOWER_KINDS`, the addressing scheme win detection's
 * count arrays are built on. Flowers deliberately have no index: they never
 * participate in a set, so a flower reaching this function means a flower
 * leaked into a hand — throw rather than silently miscount.
 */
export function kindIndex(t: TileKind): number {
  if (isFlower(t)) {
    throw new Error(`flowers have no kind index: ${t}`);
  }
  return orderOf(t);
}

const WIND_CYCLE: Wind[] = ['E', 'S', 'W', 'N'];

/** The dealer is always East for the hand; the rest count round from there. */
export function seatWind(seat: Seat, dealer: Seat): Wind {
  return WIND_CYCLE[(seat - dealer + 4) % 4]!;
}
