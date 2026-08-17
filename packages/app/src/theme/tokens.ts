/**
 * Every colour, dimension, radius and duration in the app.
 *
 * No component may hardcode a colour or a magic layout number. That is not
 * tidiness for its own sake: the spec's cosmetics pipeline (v1.2) is "a theme
 * is a swappable asset pack", and a theme can only be swapped if there is
 * exactly one place holding what a theme decides. The NAMES here are frozen;
 * the values are the default theme and get tuned on-device.
 */

export const tokens = {
  color: {
    tableFelt: '#175E43',
    tableFeltEdge: '#0E3D2C',
    tileFace: '#F6F1E7',
    tileFaceEdge: '#D9CFBB',
    /**
     * Face-down tiles sit ON the felt, so this has to be legible against it.
     * The original #2E6B4F scored 1.23:1 against `tableFelt` — an opponent's 16
     * concealed tiles rendered as one green smear you could not count. This
     * scores 2.97:1 against the felt while staying 2.31:1 from `tileFace`, so
     * it is unmistakably a back and unmistakably not a face. Enforced by
     * `test/contrast.test.ts`.
     */
    tileBack: '#5FB08A',
    inkPrimary: '#1C1B18',
    suitRed: '#B3372F',
    suitGreen: '#2E6B3D',
    suitBlue: '#274B77',
    accentGold: '#C9A24B',
    overlayScrim: 'rgba(0,0,0,0.55)',
    textOnFelt: '#F2EDE2',
    textMuted: '#A9BDB2',
    danger: '#B3372F',
    surface: '#123F2E',
    surfaceRaised: '#1B5240',
  },
  /** Base tile geometry. Every rendered size scales from this aspect ratio. */
  tile: { w: 44, h: 60, radius: 7, faceInset: 3, aspect: 44 / 60 },
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 40 },
  radius: { s: 6, m: 12, l: 20 },
  duration: { fast: 120, normal: 220, deal: 60, win: 600 },
  font: { cjk: 'NotoSerifTC_700Bold', ui: undefined },
  /** Minimum touch target. Below this, people miss on a moving table. */
  hitSlop: 44,
} as const;

/**
 * Rendered widths per context; heights derive from `tokens.tile.aspect`.
 *
 * Sized for the real target: a phone in landscape is about 880x400 CSS pixels,
 * and HEIGHT is the scarce dimension. At the original 44px hand tile the table
 * needed ~470px of vertical space and every zone overlapped the next. A 36px
 * hand tile is 49px tall, which leaves room for the opponents, the ponds and
 * the action bar to coexist. Width was never the constraint — 17 hand tiles at
 * this size span ~630px of the 880 available.
 */
export const TILE_SIZES = {
  hand: 36,
  discard: 24,
  meld: 28,
  mini: 18,
} as const;

/**
 * The reference screen: a modern Android phone held in landscape, in CSS pixels.
 *
 * Every screen must fit this without a button falling off the bottom. It is
 * deliberately the SMALL end of the real range (Galaxy S21 is 800x360, Pixel 7
 * is 914x411) so that fitting here means fitting on the fleet.
 *
 * Note what this budget does NOT include: a navigation header. The stack
 * renders headerless, because a 64px chrome bar is 18% of this screen and every
 * screen already carries its own title and its own way out.
 */
export const PHONE_LANDSCAPE = { width: 800, height: 360 } as const;

/**
 * Row heights for the lobby's seat list and the results standings in landscape,
 * where four rows plus controls share ~360px. Left to size themselves the rows
 * come out ~72px, which pushed Start off the lobby and the winner off the
 * results screen.
 */
export const COMPACT_ROW = { seat: 52, standing: 44 } as const;

/** Vertical budget for the landscape table, in CSS pixels. */
export const TABLE_ZONES = {
  /**
   * The opponent across from you: a name row that also carries their exposed
   * melds and flowers, then one row of tile backs. 56 fitted the name and backs
   * but clipped the exposed tiles, and `overflow: hidden` hid that completely.
   */
  top: 64,
  /** Your melds, flowers, hand and the action bar. */
  bottom: 152,
} as const;

/**
 * A side opponent's tile seen EDGE-ON — a thin sliver, which is both what it
 * looks like from their left or right and the only way 17 of them fit the
 * middle band of a phone screen. Rendered as full tile backs they need ~186px
 * of a ~152px zone, which is what pushed the side panels through the table.
 *
 * Thin is forced, but featureless is not. Each sliver carries a strip of the
 * tile's ivory body under its green back, the way a face-down tile actually
 * looks from the side, and they are grouped in fours. An unbroken column of 17
 * identical bars is precisely the thing an eye cannot count; in fours you read
 * it the way you read a tally — 4, 8, 12, 16, and the remainder.
 */
export const EDGE_ON_TILE = {
  width: 34,
  height: 4,
  /** Between tiles within a group of four. */
  gap: 1,
  /** Extra separation between groups, on top of `gap`. */
  groupGap: 4,
  groupSize: 4,
  /** The ivory sliver of tile body showing beneath the back. */
  faceEdge: 1,
} as const;

export type TileSizeName = keyof typeof TILE_SIZES;

export function tileHeight(width: number): number {
  return width / tokens.tile.aspect;
}
