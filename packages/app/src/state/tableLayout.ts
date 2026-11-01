/**
 * Where things sit on the table.
 *
 * Pure maths, no React — so it can be tested exhaustively without rendering
 * anything, and so the table screen holds layout *decisions* rather than
 * layout *arithmetic*.
 */

import type { Seat } from '@mahjong/engine';
import { TABLE_ZONES, tokens } from '../theme/tokens';

export type Edge = 'bottom' | 'right' | 'top' | 'left';

/** Clockwise from me: I am always at the bottom of my own screen. */
const EDGES: Edge[] = ['bottom', 'right', 'top', 'left'];

export function edgeFor(mySeat: Seat, theirSeat: Seat): Edge {
  return EDGES[(theirSeat - mySeat + 4) % 4]!;
}

/**
 * The discard ponds, one in front of each player.
 *
 * A real table puts each player's discards in front of them, and that is what
 * tells you who threw what: position, not a label. So mine runs along the
 * bottom of the felt, the player across along the top, and the side players'
 * at the left and right ends. Inside each, tiles fill left to right, top to
 * bottom.
 *
 * Sized for the worst case actually seen: across 3000 simulated hands no seat
 * ever threw more than 18 tiles (a hand typically ends at 14–15 each), so every
 * pond holds 18 at full size. The top and bottom ponds are 9 across and 2 deep,
 * the side ponds 6 across and 3 deep — wide and shallow, because on a landscape
 * phone height is the scarce dimension and every row a pond does not need is
 * height the hands get instead. Past 18 a pond squeezes its tiles together
 * rather than spilling off its mat.
 */
export const POND = {
  capacity: 18,
  /** Top and bottom ponds: tiles per row, and rows. */
  across: 9,
  deep: 2,
  /** Side ponds: columns, and tiles per column. */
  sideAcross: 6,
  sideDeep: 3,
  /** Felt between neighbouring discards. */
  gap: 1,
  /** The mat's margin around its tiles. */
  matPad: 2,
  /**
   * The least felt between the top and bottom ponds. At 4px the two read as
   * one block of discards on a small phone, and which row was whose was a guess.
   */
  centreGap: 8,
  /** Between the top and bottom ponds and the felt's own top and bottom edges. */
  rimPad: 1,
  /** Between a side pond and the felt's edge, and between it and the centre ponds. */
  edgePad: 6,
  sideGap: 10,
  /** Discard sizes the layout may choose between. */
  minTile: 16,
  maxTile: 30,
} as const;

export interface Rect { x: number; y: number; width: number; height: number }

export interface PondLayout {
  /** Width of a discard, chosen to be the largest that fits. */
  tile: number;
  /** Each seat's mat on the felt, in felt coordinates. */
  mats: Record<Edge, Rect>;
}

const TILE_ASPECT = tokens.tile.aspect;

/** The tiles' own box inside a mat, for a pond holding a full 18. */
export function pondBlock(edge: Edge, tile: number): { width: number; height: number } {
  const h = tile / TILE_ASPECT;
  const [across, deep] = isVerticalEdge(edge) ? [POND.sideAcross, POND.sideDeep] : [POND.across, POND.deep];
  return {
    width: across * (tile + POND.gap) - POND.gap,
    height: deep * (h + POND.gap) - POND.gap,
  };
}

/**
 * Where each of `count` discards sits inside its pond, relative to the block's
 * top-left. Index 0 is the first tile thrown.
 *
 * Every pond reads the same way, whatever the seat: left to right, top to
 * bottom, like a line of text. Which pond it is says whose discards they are;
 * the order inside it only has to be easy to follow. Past capacity a row holds
 * more tiles, closer together, rather than spilling off the mat.
 */
export function pondSlots(edge: Edge, count: number, tile: number): { x: number; y: number }[] {
  const h = tile / TILE_ASPECT;
  const block = pondBlock(edge, tile);
  const [across, deep] = isVerticalEdge(edge) ? [POND.sideAcross, POND.sideDeep] : [POND.across, POND.deep];
  const inRow = Math.max(across, Math.ceil(count / deep));
  const pitch = inRow > across ? (block.width - tile) / (inRow - 1) : tile + POND.gap;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: (i % inRow) * pitch, y: Math.floor(i / inRow) * (h + POND.gap) });
  }
  return out;
}

function matSize(edge: Edge, tile: number): { width: number; height: number } {
  const b = pondBlock(edge, tile);
  return { width: b.width + 2 * POND.matPad, height: b.height + 2 * POND.matPad };
}

/**
 * Where the felt — the playing surface inside the four seats — sits on the
 * table screen, as offsets from the screen's edges. It stops a few pixels short
 * of the top zone and of my melds row, so nothing resting on the rim crosses
 * the felt's rounded edge.
 */
export const FELT_INSET = {
  top: TABLE_ZONES.top + tokens.space.s,
  bottom: TABLE_ZONES.bottom + tokens.space.s + tokens.space.xs,
  side: TABLE_ZONES.side + tokens.space.s,
} as const;

/** The felt the ponds share, for a screen of this size. */
export function feltSize(screen: { width: number; height: number }): { width: number; height: number } {
  return {
    width: screen.width - 2 * FELT_INSET.side,
    height: screen.height - FELT_INSET.top - FELT_INSET.bottom,
  };
}

/**
 * Lay out all four ponds on the felt, at the largest discard size that holds
 * 18 tiles in each. A bigger screen gets bigger discards rather than more
 * empty felt.
 */
export function pondLayout(felt: { width: number; height: number }): PondLayout {
  const fits = (t: number): boolean => {
    const tb = matSize('bottom', t);
    const sd = matSize('left', t);
    const tall = Math.max(2 * (tb.height + POND.rimPad) + POND.centreGap, sd.height);
    const wide = 2 * (POND.edgePad + sd.width + POND.sideGap) + tb.width;
    return tall <= felt.height && wide <= felt.width;
  };
  let tile: number = POND.minTile;
  for (let t = POND.maxTile; t >= POND.minTile; t--) {
    if (fits(t)) { tile = t; break; }
  }

  const tb = matSize('bottom', tile);
  const sd = matSize('left', tile);
  const midY = felt.height / 2;
  const tbX = (felt.width - tb.width) / 2;
  const sideY = midY - sd.height / 2;
  return {
    tile,
    mats: {
      // Each toward its owner's edge: any felt to spare widens the gap between
      // them rather than sitting around the outside.
      top: { x: tbX, y: POND.rimPad, ...tb },
      bottom: { x: tbX, y: felt.height - POND.rimPad - tb.height, ...tb },
      left: { x: POND.edgePad, y: sideY, ...sd },
      right: { x: felt.width - POND.edgePad - sd.width, y: sideY, ...sd },
    },
  };
}

/** Opponent panels on the left and right edges render their tiles rotated. */
export function isVerticalEdge(edge: Edge): boolean {
  return edge === 'left' || edge === 'right';
}

/** Degrees to rotate an opponent's tiles so they face their own seat. */
export function rotationFor(edge: Edge): number {
  switch (edge) {
    case 'bottom': return 0;
    case 'right': return -90;
    case 'top': return 180;
    case 'left': return 90;
  }
}
