import React from 'react';
import { SvgXml } from 'react-native-svg';
import type { TileKind } from '@mahjong/engine';
import { TILE_ART } from './tileArt';
import { tokens, tileHeight } from '../theme/tokens';

/**
 * Renders one tile face from `TILE_ART`.
 *
 * Vector art scaled to whatever box it is given, so one face serves the hand,
 * a meld, the pond and an opponent's mini tiles without separate assets. The
 * art keeps its own proportions inside that box, so the face is never
 * stretched.
 */

export interface TileFaceProps {
  tile: TileKind;
  /** Rendered width in px. */
  size?: number;
  /** Rendered height in px. Defaults to the tile aspect ratio of `size`. */
  height?: number;
}

export function TileFace({ tile, size = tokens.tile.w, height }: TileFaceProps): React.ReactElement {
  return <SvgXml xml={TILE_ART[tile].xml} width={size} height={height ?? tileHeight(size)} />;
}
