/**
 * The artwork for every one of the 42 distinct tile faces.
 *
 * A face is a self-contained SVG string drawn in a shared 300×420 box. The
 * spec treats a theme as a swappable asset pack, and this is the tile-face
 * part of one: a new set of faces is a new generated file of the same shape,
 * swapped in at `TILE_ART`, with no rendering code touched.
 *
 * The default pack is samoheen's Taiwan set (public domain), chosen because it
 * is the only freely usable set drawn for Taiwanese mahjong with all 42 faces,
 * flowers and seasons included. Its source SVGs live in `assets/tiles/taiwan`
 * and `scripts/build-tile-art.mjs` generates `art/taiwan.generated.ts`.
 */

import type { TileKind } from '@mahjong/engine';
import { TAIWAN_ART } from './art/taiwan.generated';

export interface TileArt {
  /** The artist's own title for the face, e.g. "Taiwan mahjong — 5 circles". */
  label: string;
  /** A complete `<svg>` element, sized by whoever draws it. */
  xml: string;
}

/** Every face in a pack is drawn in this box. */
export const ART_VIEWBOX = { w: 300, h: 420 } as const;

/** The faces the app draws. */
export const TILE_ART: Record<TileKind, TileArt> = TAIWAN_ART;
