import { assertThat, assertAtMost } from './support';
import { ART_VIEWBOX, TILE_ART } from '../src/tiles/tileArt';
import { tokens } from '../src/theme/tokens';
import { FLOWERS, FULL_TILE_SET, NON_FLOWER_KINDS, type TileKind } from '@mahjong/engine';

/**
 * The tile faces are artwork now, not data, so what can be checked changes.
 * A test can no longer count the dots — it can check that every tile has art,
 * that each tile got the RIGHT art, and that the markup stays inside the small
 * SVG subset react-native-svg draws the same way on iOS, Android and the web.
 */

const ALL_KINDS = [...NON_FLOWER_KINDS, ...FLOWERS] as TileKind[];

describe('TILE_ART', () => {
  it('covers exactly the 42 distinct tiles, with no extras', () => {
    const keys = Object.keys(TILE_ART) as TileKind[];
    expect(keys).toHaveLength(42);
    for (const kind of ALL_KINDS) {
      assertThat(TILE_ART[kind] !== undefined, `no art for ${kind}`);
    }
    const real = new Set<string>(FULL_TILE_SET);
    for (const key of keys) assertThat(real.has(key), `${key} is not a real tile`);
  });

  it('gives each tile the art drawn for it', () => {
    // The label is the artist's own title for the file, carried through by the
    // build script. Checking it against the tile code catches a mis-mapped file
    // — 5t wearing the 5b art — which no rendering test would notice.
    const SUIT_WORD: Record<string, string> = { w: 'characters', t: 'circles', b: 'bamboos' };
    const NAMED: Record<string, string> = {
      we: 'east wind', ws: 'south wind', ww: 'west wind', wn: 'north wind',
      dr: 'red dragon', dg: 'green dragon', dw: 'white dragon',
      f1: 'plum', f2: 'orchid', f3: 'chrysanthemum', f4: 'bamboo',
      f5: 'spring', f6: 'summer', f7: 'autumn', f8: 'winter',
    };
    for (const kind of ALL_KINDS) {
      const expected = NAMED[kind] ?? `${kind[0]} ${SUIT_WORD[kind[1]!]}`;
      const label = TILE_ART[kind].label;
      assertThat(
        new RegExp(`— ${expected}\\b`).test(label),
        `${kind} carries the art labelled "${label}", expected "${expected}"`,
      );
    }
  });

  it('keeps every face to plain, self-contained shapes', () => {
    for (const kind of ALL_KINDS) {
      const { xml } = TILE_ART[kind];
      assertThat(xml.startsWith('<svg'), `${kind}: art is not an <svg> element`);
      const { x, y, w, h } = ART_VIEWBOX;
      assertThat(xml.includes(`viewBox="${x} ${y} ${w} ${h}"`),
        `${kind}: art is not shown through the shared ${w}×${h} box`);
      assertThat(xml.includes('<path'), `${kind}: art has no shapes`);
      // Masks, <use> and ids are where renderers disagree, and an id repeated
      // by two copies of the same tile on one web page makes them collide.
      for (const banned of ['<mask', '<use', '<defs', 'href', 'url(', ' id=', '<script', '<style', '<image']) {
        assertThat(!xml.includes(banned), `${kind}: art contains "${banned}"`);
      }
    }
  });

  it('is drawn to the same proportions as the tile it sits on', () => {
    // The face is fitted into the tile body without distortion, so a box of a
    // different shape shows up as uneven margins. Within 5% reads as even.
    const artAspect = ART_VIEWBOX.w / ART_VIEWBOX.h;
    assertAtMost(Math.abs(artAspect - tokens.tile.aspect) / tokens.tile.aspect, 0.05,
      'art aspect drifts from the tile aspect');
  });
});
