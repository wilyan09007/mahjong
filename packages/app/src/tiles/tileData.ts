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
  | { kind: 'bamboo'; sticks: { x: number; y: number; color: FaceColor }[] }
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
 * Bamboo. Rank 1 is traditionally a bird rather than a stick; v1 renders it as
 * a single ornamental stick (noted in the plan) so the set stays consistent
 * until the commissioned art lands.
 */
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
    [COL.c, 26], [COL.l, 60], [COL.c, 60], [COL.r, 60],
    [COL.l, 108], [COL.c, 108], [COL.r, 108],
  ],
  8: [
    [COL.l, 26], [COL.r, 26], [COL.l, 62], [COL.r, 62],
    [COL.l, 98], [COL.r, 98], [COL.l, 124], [COL.r, 124],
  ],
  9: [
    [COL.l, ROW.t], [COL.c, ROW.t], [COL.r, ROW.t],
    [COL.l, ROW.m], [COL.c, ROW.m], [COL.r, ROW.m],
    [COL.l, ROW.b], [COL.c, ROW.b], [COL.r, ROW.b],
  ],
};

function bambooFace(rank: number): FaceData {
  const layout = BAMBOO_LAYOUTS[rank];
  if (!layout) throw new Error(`no bamboo layout for rank ${rank}`);
  return {
    kind: 'bamboo',
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
