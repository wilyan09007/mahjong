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
    /**
     * The rim the players sit at, outside the playing surface. Only slightly
     * darker than `tableFelt` on purpose — enough that the table reads as a
     * surface with depth rather than a flat green field, not so much that it
     * announces itself as a band across the screen.
     */
    tableFeltRim: '#124B36',
    /** Hairline where the surface meets the rim. Catches light, very faintly. */
    tableSurfaceEdge: 'rgba(255,255,255,0.06)',
    /**
     * A seat's discard mat: a shallow tray, clearly its own object. Fainter
     * than this and two neighbouring ponds merged into one block of tiles,
     * and a pond's first tile in a new row looked like a stray.
     */
    pondMat: 'rgba(0,0,0,0.20)',
    pondMatEdge: 'rgba(255,255,255,0.12)',
    /** The seat wind watermarked on an empty mat. */
    pondWind: 'rgba(255,255,255,0.09)',
    tileFace: '#F6F1E7',
    /** The ivory side of the tile, a shade under the face. */
    tileFaceEdge: '#DDD2BC',
    /** The green back as it shows along the bottom of a face-up tile. */
    tileBackBand: '#2F7A57',
    /** Light catching the top of a tile. Over ivory or green alike. */
    tileSheen: 'rgba(255,255,255,0.34)',
    /** The glow around a selected tile. */
    tileHalo: 'rgba(222,183,92,0.55)',
    /** Call-out stamps (碰, 槓, 胡…): red lacquer with a gold rim. */
    calloutDisc: '#9B231C',
    calloutGlyph: '#F8E7B5',
    /** A hand nobody won gets a quiet stamp, not a celebration. */
    calloutMuted: '#34453D',
    /** Chow, pung and kong buttons: a blue no other surface uses, so an offer stands out. */
    claimButton: '#2B6CA3',
    /** The 胡 button: the red lacquer of the 胡 stamp, rimmed in gold. */
    winButton: '#9B231C',
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
  /** Corner radius, bands and inset scale with size — see `tiles/tileGeometry.ts`. */
  tile: { w: 44, h: 60, aspect: 44 / 60 },
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 40 },
  radius: { s: 6, m: 12, l: 20 },
  font: { cjk: 'NotoSerifTC_700Bold', ui: undefined },
  /** Minimum touch target. Below this, people miss on a moving table. */
  hitSlop: 44,
} as const;

/**
 * Rendered widths per context; heights derive from `tokens.tile.aspect`.
 *
 * Sized for the real target: a phone in landscape is about 880x400 CSS pixels,
 * and HEIGHT is the scarce dimension. The hand was 36px while four ponds sat in
 * a strip across the middle of the table; with the ponds placed in front of
 * their owners and sized to the felt (see `pondLayout`), and the action buttons
 * moved from a column down the right into the row above the hand, the hand gets
 * 42px and the full width — 17 of them fit an 800px phone without shrinking. Discards
 * are not here: their size is chosen per screen by `pondLayout`.
 */
export const TILE_SIZES = {
  hand: 42,
  /** A discard outside the table (the gallery). At the table `pondLayout` sizes them. */
  discard: 24,
  meld: 30,
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
  /**
   * Your melds and flowers, your hand, and the emote row. The action buttons
   * share the melds' row, on its right, and may rise over the felt when a busy
   * claim window needs a second line.
   */
  bottom: 140,
  /**
   * The rim down each side, where the left and right players sit. The playing
   * surface is inset by this much, so their tiles rest on the rim rather than
   * floating in the middle of the table.
   *
   * Wide enough for the concealed stack plus three `mini` tiles of exposed
   * melds side by side. A narrower rim forced those melds down to a size you
   * could not read, which is worse than spending the width — an exposed meld is
   * the strongest read you get on another player. Wider than necessary is not
   * free either: every pixel here is taken off the playing surface.
   */
  side: 112,
  /**
   * Where the side seats' rails begin, measured from the top of the screen.
   *
   * The left and right players are NOT confined to the middle band. That band
   * is bounded above by the top seat's zone — but that zone is centred on the
   * seat across the table, and its corners are empty. The only thing out there
   * is the status block, which this clears. Reclaiming those 14px is what let
   * the side tiles grow from slits into something tile-shaped.
   */
  railTop: 50,
} as const;

/**
 * How the left and right seats' concealed hands are drawn.
 *
 * Real tile backs, LAID DOWN — wider than tall. Those players' tiles face them,
 * so from your seat they are turned ninety degrees; upright backs were drawn
 * from your own point of view rather than theirs.
 *
 * Nothing overlaps. Two columns of nine at this size come to ~133px in a ~142px
 * budget, so every tile can be drawn whole with clear felt between it and the
 * next. Earlier versions overlapped precisely because they kept the tiles
 * upright, which is 24.5px each and never fit.
 */
export const SIDE_STACK = {
  /** A laid-down tile's width; its height follows from the tile aspect. */
  tileWidth: 18,
  /** Felt between tiles. They are separate objects, so they never touch. */
  gap: 1,
  /** Extra separation between groups of four, so a column can be counted. */
  groupGap: 3,
  /**
   * Two columns, not one. A player holds 17 tiles at most, so each column runs
   * to 9 — short enough to fit the rail whole, without overlapping.
   */
  columns: 2,
  groupSize: 4,
} as const;

/** Tiles per column when `count` are split across `SIDE_STACK.columns`. */
export function sideStackColumns(count: number): number[] {
  const per = Math.ceil(count / SIDE_STACK.columns);
  const out: number[] = [];
  for (let left = count; left > 0; left -= per) out.push(Math.min(per, left));
  return out;
}

export type TileSizeName = keyof typeof TILE_SIZES;

export function tileHeight(width: number): number {
  return width / tokens.tile.aspect;
}
