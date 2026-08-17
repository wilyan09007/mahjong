/**
 * Where things sit on the table.
 *
 * Pure maths, no React — so it can be tested exhaustively without rendering
 * anything, and so the table screen holds layout *decisions* rather than
 * layout *arithmetic*.
 */

import type { Seat } from '@mahjong/engine';

export type Edge = 'bottom' | 'right' | 'top' | 'left';

/** Clockwise from me: I am always at the bottom of my own screen. */
const EDGES: Edge[] = ['bottom', 'right', 'top', 'left'];

export function edgeFor(mySeat: Seat, theirSeat: Seat): Edge {
  return EDGES[(theirSeat - mySeat + 4) % 4]!;
}

/** Discard ponds lay out six to a row. */
export const DISCARDS_PER_ROW = 6;

export function discardGrid(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 0, rows: 0 };
  return {
    cols: Math.min(count, DISCARDS_PER_ROW),
    rows: Math.ceil(count / DISCARDS_PER_ROW),
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
