/**
 * The face of every one of the 42 distinct tiles, as data.
 *
 * Data rather than 42 hand-drawn SVG files, because the spec's whole art
 * argument is that "a theme is a swappable asset pack". A face described as
 * coordinates and colour *names* can be re-skinned by changing tokens; a face
 * baked into an SVG file cannot. It also means the set is verifiable — a test
 * can assert that the 5-dot tile really has five dots, which no pile of
 * hand-drawn files can promise.
 *
 * All coordinates live in a fixed 100×140 viewBox, matching `tokens.tile`'s
 * 44:60 aspect. Colours are token NAMES, resolved at render time.
 */

import { FLOWERS, NON_FLOWER_KINDS, type TileKind } from '@mahjong/engine';

export type FaceColor = 'inkPrimary' | 'suitRed' | 'suitGreen' | 'suitBlue';

export type FaceData =
  | { kind: 'dots'; circles: { cx: number; cy: number; r: number; color: FaceColor }[] }
  | {
      kind: 'bamboo';
      /** Length of each stick. Derived per face so rows never collide. */
      stickHeight: number;
      sticks: { x: number; y: number; color: FaceColor }[];
    }
  | { kind: 'glyph'; chars: string[]; colors: FaceColor[] }
  /** The white dragon 白 is a bordered empty frame, not a character. */
  | { kind: 'frame' };

export const VIEWBOX = { w: 100, h: 140 } as const;

// Layout grid for dots and bamboo. Kept well inside the box so nothing clips
// against the tile's rounded corners.
// Columns sit 24 apart, which is the tightest spacing that still clears two
// radius-11 dots side by side. At 20 apart the 3x3 nine-dot face overlaps into
// blobs — caught by the geometry test, not by eye.
const COL = { l: 26, c: 50, r: 74 } as const;
const ROW = { t: 36, m: 70, b: 104 } as const;
const DOT_R = 11;

type Point = readonly [number, number];

/**
 * Traditional dot arrangements. 1 is a single large circle; 5 and 9 are the
 * familiar quincunx and 3×3; 7 is the diagonal-three over a 2×2.
 */
const DOT_LAYOUTS: Record<number, Point[]> = {
  1: [[COL.c, ROW.m]],
  2: [[COL.c, ROW.t], [COL.c, ROW.b]],
  3: [[COL.l, ROW.t], [COL.c, ROW.m], [COL.r, ROW.b]],
  4: [[COL.l, ROW.t], [COL.r, ROW.t], [COL.l, ROW.b], [COL.r, ROW.b]],
  5: [[COL.l, ROW.t], [COL.r, ROW.t], [COL.c, ROW.m], [COL.l, ROW.b], [COL.r, ROW.b]],
  6: [
    [COL.l, ROW.t], [COL.r, ROW.t], [COL.l, ROW.m],
    [COL.r, ROW.m], [COL.l, ROW.b], [COL.r, ROW.b],
  ],
  7: [
    [COL.l, 26], [COL.c, 42], [COL.r, 58],
    [COL.l, 88], [COL.r, 88], [COL.l, 116], [COL.r, 116],
  ],
  8: [
    [COL.l, 26], [COL.r, 26], [COL.l, 60], [COL.r, 60],
    [COL.l, 94], [COL.r, 94], [COL.l, 122], [COL.r, 122],
  ],
  9: [
    [COL.l, ROW.t], [COL.c, ROW.t], [COL.r, ROW.t],
    [COL.l, ROW.m], [COL.c, ROW.m], [COL.r, ROW.m],
    [COL.l, ROW.b], [COL.c, ROW.b], [COL.r, ROW.b],
  ],
};

/** Rank colouring follows tradition: 1 and 9 red-accented, middles blue/green. */
function dotColor(rank: number, index: number): FaceColor {
  if (rank === 1) return 'suitRed';
  if (rank === 5) return index === 2 ? 'suitRed' : 'suitBlue';
  return index % 2 === 0 ? 'suitBlue' : 'suitGreen';
}

function dotsFace(rank: number): FaceData {
  const layout = DOT_LAYOUTS[rank];
  if (!layout) throw new Error(`no dot layout for rank ${rank}`);
  return {
    kind: 'dots',
    circles: layout.map(([cx, cy], i) => ({
      cx,
      cy,
      r: rank === 1 ? DOT_R * 1.7 : DOT_R,
      color: dotColor(rank, i),
    })),
  };
}

/**
 * Bamboo (條/索).
 *
 * A 索 is a LINE, not a dot — that is the entire visual difference between this
 * suit and 筒, and getting it wrong makes 九條 read as 九筒. The stick is drawn
 * as an elongated capsule `STICK_W` wide by `stickHeight` tall, and
 * `MIN_STICK_ASPECT` below is the enforced floor on how line-like that has to
 * be.
 *
 * Rank 1 is traditionally a bird rather than a stick; v1 renders it as a single
 * tall ornamental stick until commissioned art lands.
 */
export const STICK_W = 9;
/** A stick must be at least this many times taller than it is wide. */
export const MIN_STICK_ASPECT = 2.5;
const STICK_MAX_H = 30;
/** Clear space between the ends of two vertically adjacent sticks. */
const STICK_GAP = 4;

/**
 * The node markings drawn across each stick, as a fraction of the stick.
 *
 * These live here, not in the renderer, so the rule that matters is
 * *checkable*: a node must be NARROWER than the stick it decorates and a small
 * fraction of its length. The first version of this art drew one node as an
 * opaque ellipse 1.4× the stick's width, which did not decorate the stick — it
 * cut it into two stubs, and 九條 came out looking like 九筁. A test can catch
 * that ratio; it cannot catch "looks wrong".
 */
export const STICK_NODE = {
  /** Node width as a fraction of `STICK_W`. Must be < 1. */
  widthRatio: 0.68,
  /** Node thickness as a fraction of the stick's length. Must be small. */
  heightRatio: 0.07,
  /** Node centres, as a fraction of the stick's length from its middle. */
  offsets: [-0.34, 0.34] as const,
  /** Drawn in the tile-face colour at this opacity — a hint, not a cut. */
  opacity: 0.5,
} as const;

const BAMBOO_LAYOUTS: Record<number, Point[]> = {
  1: [[COL.c, ROW.m]],
  2: [[COL.c, ROW.t], [COL.c, ROW.b]],
  3: [[COL.c, 30], [COL.l, ROW.b], [COL.r, ROW.b]],
  4: [[COL.l, ROW.t], [COL.r, ROW.t], [COL.l, ROW.b], [COL.r, ROW.b]],
  5: [[COL.l, ROW.t], [COL.r, ROW.t], [COL.c, ROW.m], [COL.l, ROW.b], [COL.r, ROW.b]],
  6: [
    [COL.l, ROW.t], [COL.r, ROW.t], [COL.l, ROW.m],
    [COL.r, ROW.m], [COL.l, ROW.b], [COL.r, ROW.b],
  ],
  7: [
    [COL.c, 30], [COL.l, 70], [COL.c, 70], [COL.r, 70],
    [COL.l, 110], [COL.c, 110], [COL.r, 110],
  ],
  // Four rows have to share 140 units, so they sit closer together than the
  // three-row faces; `stickHeightFor` shortens the sticks to match.
  8: [
    [COL.l, 25], [COL.r, 25], [COL.l, 58], [COL.r, 58],
    [COL.l, 91], [COL.r, 91], [COL.l, 124], [COL.r, 124],
  ],
  9: [
    [COL.l, ROW.t], [COL.c, ROW.t], [COL.r, ROW.t],
    [COL.l, ROW.m], [COL.c, ROW.m], [COL.r, ROW.m],
    [COL.l, ROW.b], [COL.c, ROW.b], [COL.r, ROW.b],
  ],
};

/**
 * The longest stick this layout can carry: short enough that vertically
 * adjacent rows keep `STICK_GAP` between them and nothing runs off the tile.
 * Derived rather than hardcoded so adjusting a layout cannot silently produce
 * overlapping sticks.
 */
function stickHeightFor(layout: Point[]): number {
  const ys = [...new Set(layout.map(([, y]) => y))].sort((a, b) => a - b);

  let height = ys.length < 2
    ? 40 // a lone stick has the whole tile, so make it properly ornamental
    : STICK_MAX_H;

  for (let i = 1; i < ys.length; i++) {
    height = Math.min(height, ys[i]! - ys[i - 1]! - STICK_GAP);
  }
  // Keep both ends inside the viewBox.
  const top = ys[0]!;
  const bottom = ys[ys.length - 1]!;
  return Math.min(height, (top - 2) * 2, (VIEWBOX.h - 2 - bottom) * 2);
}

function bambooFace(rank: number): FaceData {
  const layout = BAMBOO_LAYOUTS[rank];
  if (!layout) throw new Error(`no bamboo layout for rank ${rank}`);
  const stickHeight = stickHeightFor(layout);
  if (stickHeight < STICK_W * MIN_STICK_ASPECT) {
    throw new Error(
      `bamboo rank ${rank}: sticks would be ${stickHeight} tall by ${STICK_W} wide, ` +
        `which reads as a dot rather than a line — spread the rows out`,
    );
  }
  return {
    kind: 'bamboo',
    stickHeight,
    // Rank 1 and the top stick of 7 are red by tradition.
    sticks: layout.map(([x, y], i) => ({
      x,
      y,
      color: rank === 1 || (rank === 7 && i === 0) ? 'suitRed' : 'suitGreen',
    })),
  };
}

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;
const WIND_GLYPHS: Record<string, string> = { we: '東', ws: '南', ww: '西', wn: '北' };
/** 梅蘭菊竹 (the four gentlemen) then 春夏秋冬 (the seasons). */
const FLOWER_GLYPHS = ['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬'] as const;

function buildFaceData(): Record<TileKind, FaceData> {
  const data = {} as Record<TileKind, FaceData>;

  for (const kind of NON_FLOWER_KINDS) {
    const rank = Number(kind[0]);
    const suit = kind[1];

    if (suit === 'w' && rank >= 1 && rank <= 9) {
      // Characters: the numeral above, 萬 below in red.
      data[kind] = {
        kind: 'glyph',
        chars: [CHINESE_NUMERALS[rank - 1]!, '萬'],
        colors: ['inkPrimary', 'suitRed'],
      };
    } else if (suit === 't' && rank >= 1 && rank <= 9) {
      data[kind] = dotsFace(rank);
    } else if (suit === 'b' && rank >= 1 && rank <= 9) {
      data[kind] = bambooFace(rank);
    } else if (kind in WIND_GLYPHS) {
      data[kind] = { kind: 'glyph', chars: [WIND_GLYPHS[kind]!], colors: ['inkPrimary'] };
    } else if (kind === 'dr') {
      data[kind] = { kind: 'glyph', chars: ['中'], colors: ['suitRed'] };
    } else if (kind === 'dg') {
      data[kind] = { kind: 'glyph', chars: ['發'], colors: ['suitGreen'] };
    } else if (kind === 'dw') {
      data[kind] = { kind: 'frame' };
    } else {
      throw new Error(`no face defined for tile ${kind}`);
    }
  }

  FLOWERS.forEach((flower, i) => {
    data[flower] = {
      kind: 'glyph',
      chars: [FLOWER_GLYPHS[i]!],
      // The four gentlemen in green, the seasons in red.
      colors: [i < 4 ? 'suitGreen' : 'suitRed'],
    };
  });

  return data;
}

export const FACE_DATA: Record<TileKind, FaceData> = buildFaceData();
