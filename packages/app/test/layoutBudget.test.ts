import { assertAtMost, assertAtLeast } from './support';
import {
  EDGE_ON_TILE, TABLE_ZONES, TILE_SIZES, tileHeight, tokens,
} from '../src/theme/tokens';

/**
 * The landscape table has to fit a phone, and height is the scarce dimension.
 *
 * Written after the table was first "verified" in a 1100x900 desktop window and
 * looked fine, then rendered at a real 880x400 phone-landscape viewport with
 * every zone — opponents, ponds, hand, action bar — stacked on top of one
 * another. Nothing in the type system or the component tests could notice that;
 * this is arithmetic, so it can be a rule.
 *
 * Reference viewport: a modern Android phone in landscape is roughly 880x400
 * CSS pixels (e.g. Pixel 7 at 914x411, Galaxy S21 at 800x360).
 */

const PHONE_LANDSCAPE = { width: 800, height: 360 };

describe('landscape table fits a phone', () => {
  it('the fixed zones leave usable room for the middle of the table', () => {
    const fixed = TABLE_ZONES.top + TABLE_ZONES.bottom;
    const middle = PHONE_LANDSCAPE.height - fixed;
    assertAtLeast(
      middle, 120,
      `top (${TABLE_ZONES.top}) + bottom (${TABLE_ZONES.bottom}) leave only ` +
        `${middle}px for opponents, the wall indicator and four discard ponds`,
    );
  });

  it('my hand, melds and action bar fit the bottom zone', () => {
    const handRow = tileHeight(TILE_SIZES.hand) + 10; // tiles lift 10px when selected
    const melds = 30;
    const actions = tokens.hitSlop + 12;
    const total = handRow + melds + actions;
    assertAtMost(
      total, TABLE_ZONES.bottom + 12,
      `hand (${Math.round(handRow)}) + melds (${melds}) + actions (${actions}) ` +
        `= ${Math.round(total)}px in a ${TABLE_ZONES.bottom}px zone`,
    );
  });

  it('a full 17-tile hand fits across the screen without wrapping', () => {
    const width = 17 * (TILE_SIZES.hand + 2);
    assertAtMost(
      width, PHONE_LANDSCAPE.width,
      `17 hand tiles span ${width}px on a ${PHONE_LANDSCAPE.width}px screen — ` +
        `the hand would wrap to a second row and eat the action bar`,
    );
  });

  it("an opponent's 17 concealed tiles fit one row across the top", () => {
    const width = 17 * (TILE_SIZES.mini + 1);
    assertAtMost(
      width, PHONE_LANDSCAPE.width,
      `${width}px of tile backs across a ${PHONE_LANDSCAPE.width}px screen`,
    );
  });

  it('the top zone is tall enough for a name and one row of tile backs', () => {
    const needed = 16 + tileHeight(TILE_SIZES.mini) + 6;
    assertAtMost(
      needed, TABLE_ZONES.top,
      `top opponent needs ${Math.round(needed)}px but the zone is ${TABLE_ZONES.top}px — ` +
        `their tiles would be clipped and could not be counted`,
    );
  });

  it('four discard ponds fit side by side', () => {
    const pond = 6 * (TILE_SIZES.discard + 1);
    const total = 4 * pond + 3 * tokens.space.s;
    assertAtMost(
      total, PHONE_LANDSCAPE.width,
      `four ponds span ${total}px on a ${PHONE_LANDSCAPE.width}px screen`,
    );
  });

  it("a side opponent's 17 concealed tiles fit the middle band", () => {
    // THE constraint that forced the edge-on design. Rendered as full mini tile
    // backs, 17 of them stack ~186px deep in a ~152px band, which is what drove
    // the side panels straight through the middle of the table.
    const middle = PHONE_LANDSCAPE.height - TABLE_ZONES.top - TABLE_ZONES.bottom;
    const stack = 17 * (EDGE_ON_TILE.height + EDGE_ON_TILE.gap);
    const nameAndMelds = 16 + 30;
    assertAtMost(
      stack + nameAndMelds, middle,
      `a side opponent needs ${Math.round(stack + nameAndMelds)}px but the middle ` +
        `band is only ${middle}px — their tiles would overlap the ponds and the hand`,
    );

    // And prove the alternative really does not fit, so this test is not
    // passing by luck: full tile backs would need far more than the band has.
    const asFullTiles = Math.ceil(17 / 3) * (tileHeight(TILE_SIZES.mini) + 1);
    assertAtLeast(
      asFullTiles + nameAndMelds, middle,
      'full tile backs now fit, so the edge-on rendering is no longer load-bearing',
    );
  });

  it('touch targets stay thumb-sized', () => {
    // A moving table with small targets is how people misclick a discard.
    assertAtLeast(tokens.hitSlop, 44, 'minimum touch target is below 44px');
    assertAtLeast(
      TILE_SIZES.hand, 32,
      'hand tiles are the primary touch target and must stay tappable',
    );
  });
});
