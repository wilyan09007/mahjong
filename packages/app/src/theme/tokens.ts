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

/** Rendered widths per context; heights derive from `tokens.tile.aspect`. */
export const TILE_SIZES = {
  hand: 44,
  discard: 30,
  meld: 34,
  mini: 22,
} as const;

export type TileSizeName = keyof typeof TILE_SIZES;

export function tileHeight(width: number): number {
  return width / tokens.tile.aspect;
}
