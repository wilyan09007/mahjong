import { assertThat } from './support';
import {
  POND, edgeFor, feltSize, isVerticalEdge, pondBlock, pondLayout, pondSlots, rotationFor, type Edge,
} from '../src/state/tableLayout';
import { PHONE_LANDSCAPE } from '../src/theme/tokens';
import type { Seat } from '@mahjong/engine';

const EDGES: Edge[] = ['bottom', 'right', 'top', 'left'];

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

describe('pondSlots', () => {
  const T = 22;
  const H = T / (44 / 60);

  it('fills every pond left to right, top to bottom, whatever the seat', () => {
    for (const edge of EDGES) {
      const slots = pondSlots(edge, POND.capacity, T);
      for (let i = 1; i < slots.length; i++) {
        const [a, b] = [slots[i - 1]!, slots[i]!];
        const sameRow = Math.abs(a.y - b.y) < 0.01;
        assertThat(
          (sameRow && b.x > a.x) || (b.y > a.y && b.x < a.x),
          `${edge}: discard ${i} is not to the right of, or on the row below, discard ${i - 1}`,
        );
      }
      assertThat(slots[0]!.x === 0 && slots[0]!.y === 0, `${edge}: the first discard is not top-left`);
    }
  });

  it('gives a full pond’s 18 tiles their own place, inside the mat', () => {
    for (const edge of EDGES) {
      const slots = pondSlots(edge, POND.capacity, T);
      const block = pondBlock(edge, T);
      const keys = new Set(slots.map((p) => `${p.x},${p.y}`));
      assertThat(keys.size === POND.capacity, `${edge}: two discards share a place`);
      for (const p of slots) {
        assertThat(p.x >= 0 && p.y >= 0 && p.x + T <= block.width + 0.01 && p.y + H <= block.height + 0.01,
          `${edge}: a discard at ${p.x},${p.y} falls outside its ${block.width}x${block.height} pond`);
      }
    }
  });

  it('squeezes an unusually long pond together rather than spilling out of it', () => {
    for (const edge of EDGES) {
      const block = pondBlock(edge, T);
      for (const p of pondSlots(edge, 30, T)) {
        assertThat(p.x + T <= block.width + 0.01 && p.y + H <= block.height + 0.01,
          `${edge}: discard ${p.x},${p.y} spills out of the pond`);
      }
    }
  });
});

describe('pondLayout', () => {
  const felt = feltSize(PHONE_LANDSCAPE);
  const layout = pondLayout(felt);

  it('keeps every mat on the felt and clear of the others', () => {
    const mats = EDGES.map((e) => [e, layout.mats[e]] as const);
    for (const [edge, m] of mats) {
      assertThat(m.x >= 0 && m.y >= 0 && m.x + m.width <= felt.width && m.y + m.height <= felt.height,
        `${edge} mat leaves the felt`);
    }
    for (let i = 0; i < mats.length; i++) {
      for (let j = i + 1; j < mats.length; j++) {
        const [ea, a] = mats[i]!; const [eb, b] = mats[j]!;
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        assertThat(apart, `${ea} and ${eb} mats overlap`);
      }
    }
  });

  it('puts each pond on its owner’s side of the table', () => {
    const cx = (e: Edge) => layout.mats[e].x + layout.mats[e].width / 2;
    const cy = (e: Edge) => layout.mats[e].y + layout.mats[e].height / 2;
    assertThat(cy('bottom') > felt.height / 2, 'mine sits below the middle');
    assertThat(cy('top') < felt.height / 2, 'across sits above the middle');
    assertThat(cx('left') < cx('bottom') && cx('right') > cx('bottom'), 'sides sit to their sides');
  });

  it('keeps a clear gap between my pond and the one across, so neither reads as the other’s', () => {
    for (const screen of [PHONE_LANDSCAPE, { width: 880, height: 400 }]) {
      const l = pondLayout(feltSize(screen));
      const gap = l.mats.bottom.y - (l.mats.top.y + l.mats.top.height);
      assertThat(gap >= POND.centreGap, `${screen.width}x${screen.height}: only ${gap}px between them`);
    }
  });

  it('uses spare felt for bigger discards rather than leaving it empty', () => {
    const roomy = pondLayout(feltSize({ width: 880, height: 400 }));
    assertThat(roomy.tile > layout.tile, `880x400 draws ${roomy.tile}px discards, same as the small phone`);
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
