import { assertAtLeast, assertAtMost, assertThat } from './support';
import { tileGeometry } from '../src/tiles/tileGeometry';
import { ART_VIEWBOX } from '../src/tiles/tileArt';
import { TILE_SIZES, tileHeight } from '../src/theme/tokens';

/**
 * The tile body's proportions, as arithmetic.
 *
 * These exist because the first tiles with real art looked like miniatures: a
 * corner radius of 7px on a 36px tile is a fifth of its width, which reads as a
 * sweet rather than a tile, and the art sat inside its own 15% margins plus the
 * body's inset. Each rule below is one of those, pinned.
 */

const SIZES = Object.entries(TILE_SIZES) as [string, number][];

describe('tileGeometry', () => {
  it('rounds the corners like a tile, not a pill', () => {
    for (const [name, w] of SIZES) {
      const g = tileGeometry(w, tileHeight(w));
      assertAtMost(g.radius / w, 0.13, `${name}: radius ${g.radius} on a ${w}px tile`);
      assertAtLeast(g.radius, 1.5, `${name}: corners vanish entirely`);
    }
  });

  it('lets the art fill most of the tile width', () => {
    // The art's drawn content spans 255 of the 268 units in its box. At hand
    // size it now covers ~80% of the tile's width, against ~70% before.
    for (const [name, w] of SIZES) {
      const g = tileGeometry(w, tileHeight(w));
      const artW = Math.min(g.face.width, g.face.height * (ART_VIEWBOX.w / ART_VIEWBOX.h));
      assertAtLeast((artW * 255) / ART_VIEWBOX.w / w, 0.76, `${name}: art covers too little`);
    }
  });

  it('shows the tile’s thickness, ivory over green, at every size', () => {
    for (const [name, w] of SIZES) {
      const h = tileHeight(w);
      const g = tileGeometry(w, h);
      assertAtLeast(g.ivoryBand, 1, `${name}: ivory side disappears`);
      assertAtLeast(g.backBand, 1, `${name}: green back disappears`);
      // Thickness is a cue, not a feature: past ~12% of the height the tile
      // reads as a brick standing on its end.
      assertAtMost((g.ivoryBand + g.backBand) / h, 0.12, `${name}: tile looks too thick`);
      assertThat(
        Math.abs(g.face.height + 2 * g.inset + g.ivoryBand + g.backBand - h) < 0.01,
        `${name}: face and bands do not add up to the tile`,
      );
    }
  });
});
