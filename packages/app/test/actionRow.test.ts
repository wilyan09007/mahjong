import { assertAtMost, assertEqual, assertThat } from './support';
import { ACTION_SIZES, estimateButtonWidth, layoutActionRow, type ActionSize } from '../src/state/actionRow';
import { tokens } from '../src/theme/tokens';

/**
 * The action buttons sit in one row above my hand. They shrink only when that
 * gets them into one row, and wrap upward — over my own discards — only when
 * nothing else fits. These pin that order of preference.
 */

const btn = (label: string, tiles = 0) => ({ label, tiles });
const SIZES: ActionSize[] = ['regular', 'compact', 'tight'];

describe('layoutActionRow', () => {
  it('keeps the regular size when the row fits', () => {
    const layout = layoutActionRow([btn('Pass'), btn('碰')], 600);
    assertEqual(layout.size, 'regular', 'size');
    assertEqual(layout.rows.length, 1, 'rows');
  });

  it('shrinks a step when that is what gets it onto one row', () => {
    const buttons = [btn('Pass'), btn('吃', 3), btn('吃', 3), btn('碰'), btn('胡')];
    const regular = buttons.reduce((w, b) => w + estimateButtonWidth(b, 'regular'), 0);
    const compact = buttons.reduce((w, b) => w + estimateButtonWidth(b, 'compact'), 0);
    const room = (regular + compact) / 2 + (buttons.length - 1) * tokens.space.s;
    const layout = layoutActionRow(buttons, room);
    assertEqual(layout.size, 'compact', 'size');
    assertEqual(layout.rows.length, 1, 'rows');
  });

  it('wraps upward only when even the smallest size will not fit one row', () => {
    const buttons = [btn('Pass'), btn('吃', 3), btn('吃', 3), btn('吃', 3), btn('碰'), btn('槓', 1), btn('胡')];
    const layout = layoutActionRow(buttons, 260);
    assertThat(layout.rows.length > 1, 'should have wrapped');
    // Every button appears exactly once, in order, reading the rows top-down
    // (rows[0] is the bottom row, nearest the hand).
    expect([...layout.rows].reverse().flat()).toEqual(buttons.map((_, i) => i));
    for (const row of layout.rows) {
      const w = row.reduce((s, i) => s + estimateButtonWidth(buttons[i]!, layout.size), 0)
        + (row.length - 1) * tokens.space.s;
      assertAtMost(w, 260, `a row is ${w}px in 260`);
    }
    // The row nearest the hand is the one holding the primary (last) action.
    assertThat(layout.rows[0]!.includes(buttons.length - 1), 'the bottom row must hold the last button');
  });

  it('keeps every size thumb-sized to touch, however small it draws', () => {
    for (const size of SIZES) {
      const s = ACTION_SIZES[size];
      assertThat(s.height + 2 * s.hitSlop >= tokens.hitSlop, `${size}: touch area below ${tokens.hitSlop}px`);
    }
  });
});
