import { assertThat, assertAtLeast } from './support';
import { discardGrid, edgeFor, isVerticalEdge, rotationFor } from '../src/state/tableLayout';
import type { Seat } from '@mahjong/engine';

describe('edgeFor', () => {
  it('always puts me at the bottom of my own screen', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(edgeFor(seat, seat)).toBe('bottom');
    }
  });

  it('places the others clockwise from me', () => {
    expect(edgeFor(0, 1)).toBe('right');
    expect(edgeFor(0, 2)).toBe('top');
    expect(edgeFor(0, 3)).toBe('left');
    expect(edgeFor(2, 3)).toBe('right');
    expect(edgeFor(3, 0)).toBe('right');
    expect(edgeFor(3, 2)).toBe('left');
  });

  it('gives every seat four distinct edges, from every point of view', () => {
    for (const me of [0, 1, 2, 3] as Seat[]) {
      const edges = ([0, 1, 2, 3] as Seat[]).map((them) => edgeFor(me, them));
      assertThat(
        new Set(edges).size === 4,
        `seat ${me} saw duplicate edges: ${edges.join(',')}`,
      );
    }
  });
});

describe('discardGrid', () => {
  it('lays out six per row', () => {
    expect(discardGrid(0)).toEqual({ cols: 0, rows: 0 });
    expect(discardGrid(1)).toEqual({ cols: 1, rows: 1 });
    expect(discardGrid(6)).toEqual({ cols: 6, rows: 1 });
    expect(discardGrid(7)).toEqual({ cols: 6, rows: 2 });
    expect(discardGrid(18)).toEqual({ cols: 6, rows: 3 });
  });

  it('always has room for every discard', () => {
    for (let n = 0; n < 40; n++) {
      const { cols, rows } = discardGrid(n);
      assertAtLeast(cols * rows, n, `grid too small for ${n} discards`);
    }
  });
});

describe('edge helpers', () => {
  it('knows which edges run vertically', () => {
    expect(isVerticalEdge('left')).toBe(true);
    expect(isVerticalEdge('right')).toBe(true);
    expect(isVerticalEdge('top')).toBe(false);
    expect(isVerticalEdge('bottom')).toBe(false);
  });

  it('rotates opponent tiles to face their own seat', () => {
    expect(rotationFor('bottom')).toBe(0);
    expect(rotationFor('right')).toBe(-90);
    expect(rotationFor('top')).toBe(180);
    expect(rotationFor('left')).toBe(90);
  });
});
