/**
 * How the action buttons fit the row above my hand.
 *
 * The buttons sit side by side in the space between the felt and my tiles,
 * right-aligned, with my melds holding the left of the same row. The order of
 * preference when they do not fit:
 *   1. the regular size, one row;
 *   2. a smaller size, if that gets them onto one row;
 *   3. wrapped into rows stacking UPWARD, over my own discards — the last
 *      resort, and brief: a claim window lasts seconds.
 * The row nearest the hand always holds the last buttons, which are the
 * primary ones (胡, Discard), so the most important action never moves away
 * from the thumb.
 *
 * Pure: widths are estimated from the label and tile count, so the decision is
 * testable and never waits on a layout pass.
 */

import { tokens } from '../theme/tokens';

export type ActionSize = 'regular' | 'compact' | 'tight';

/**
 * Every size draws at least `tokens.hitSlop` tall to the finger: a smaller
 * button is extended by `hitSlop` on each side, so shrinking the drawing
 * never shrinks the target.
 */
export const ACTION_SIZES: Record<ActionSize, {
  height: number; fontSize: number; padH: number; tile: number; hitSlop: number;
}> = {
  regular: { height: 44, fontSize: 17, padH: 16, tile: 16, hitSlop: 0 },
  compact: { height: 40, fontSize: 15, padH: 11, tile: 14, hitSlop: 2 },
  tight: { height: 36, fontSize: 13, padH: 7, tile: 12, hitSlop: 4 },
};

/** Between a label and the tiles beside it, and between two tiles. */
const LABEL_GAP = 6;
const TILE_GAP = 1;

export interface ActionRowButton {
  label: string;
  /** How many small tiles the button shows (a chow's run, a kong's tile). */
  tiles: number;
}

/** CJK glyphs are a full em wide; bold Latin averages a little over half. */
function textWidth(label: string, fontSize: number): number {
  let w = 0;
  for (const ch of label) w += (ch.codePointAt(0) ?? 0) > 0x2e80 ? fontSize : fontSize * 0.62;
  return w;
}

export function estimateButtonWidth(button: ActionRowButton, size: ActionSize): number {
  const s = ACTION_SIZES[size];
  const tiles = button.tiles > 0 ? LABEL_GAP + button.tiles * (s.tile + TILE_GAP) - TILE_GAP : 0;
  return Math.ceil(2 * s.padH + textWidth(button.label, s.fontSize) + tiles);
}

export interface ActionRowLayout {
  size: ActionSize;
  /** Button indices per row; `rows[0]` is the row nearest the hand. */
  rows: number[][];
}

function rowWidth(buttons: ActionRowButton[], indices: number[], size: ActionSize): number {
  return indices.reduce((w, i) => w + estimateButtonWidth(buttons[i]!, size), 0)
    + Math.max(0, indices.length - 1) * tokens.space.s;
}

export function layoutActionRow(buttons: ActionRowButton[], available: number): ActionRowLayout {
  const all = buttons.map((_, i) => i);
  for (const size of ['regular', 'compact', 'tight'] as const) {
    if (rowWidth(buttons, all, size) <= available) return { size, rows: [all] };
  }

  // Nothing fits on one row: wrap at the compact size, which stays easy to
  // read, filling from the LAST button so the primary action stays bottom-right.
  const size: ActionSize = 'compact';
  const rows: number[][] = [];
  let row: number[] = [];
  for (let i = buttons.length - 1; i >= 0; i--) {
    const candidate = [i, ...row];
    if (row.length > 0 && rowWidth(buttons, candidate, size) > available) {
      rows.push(row);
      row = [i];
    } else {
      row = candidate;
    }
  }
  if (row.length > 0) rows.push(row);
  return { size, rows };
}

/** Height of `rows` rows of buttons at `size`, gaps included. */
export function actionRowHeight(rows: number, size: ActionSize): number {
  return rows * ACTION_SIZES[size].height + Math.max(0, rows - 1) * tokens.space.xs;
}
