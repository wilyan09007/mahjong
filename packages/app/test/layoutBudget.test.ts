import { assertAtMost, assertAtLeast } from './support';
import {
  COMPACT_ROW, EDGE_ON_TILE, PHONE_LANDSCAPE, TABLE_ZONES, TILE_SIZES, tileHeight, tokens,
} from '../src/theme/tokens';

/**
 * Every screen has to fit a phone, and height is the scarce dimension.
 *
 * Written after the table was first "verified" in a 1100x900 desktop window and
 * looked fine, then rendered at a real 880x400 phone-landscape viewport with
 * every zone — opponents, ponds, hand, action bar — stacked on top of one
 * another. Nothing in the type system or the component tests could notice that;
 * this is arithmetic, so it can be a rule.
 *
 * The menu screens then failed the same way, one at a time, each only found by
 * looking: Home clipped its Join button, the lobby clipped Start, and Results
 * clipped the first-place row off the top and "Leave table" off the bottom. So
 * they get budgets here too rather than another round of discovery by eye.
 */

/** A button as `Controls.tsx` renders it. */
const BUTTON = tokens.hitSlop + 12;

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

  it('the top zone fits a name row carrying exposed tiles, plus backs', () => {
    // The name row has to hold mini tiles, because an opponent's melds and
    // flowers ride along it. Budgeting it as text-only is how the first version
    // passed while `overflow: hidden` was quietly eating every exposed meld.
    const chrome = 2 * tokens.space.xs + 2 * 2; // padding + border
    const nameRow = Math.max(16, tileHeight(TILE_SIZES.mini));
    const needed = chrome + nameRow + 2 + tileHeight(TILE_SIZES.mini);
    assertAtMost(
      needed, TABLE_ZONES.top,
      `top opponent needs ${Math.round(needed)}px but the zone is ${TABLE_ZONES.top}px — ` +
        'their exposed melds would be clipped away without a trace',
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
    // Exposed tiles sit BESIDE the stack, so they cost width, not height — the
    // panel is as tall as the taller of the two, not their sum.
    const body = Math.max(stack, 4 * (tileHeight(TILE_SIZES.mini) + 1));
    const nameAndMelds = 16 + 2 * tokens.space.xs + 2 * 2;
    assertAtMost(
      body + nameAndMelds, middle,
      `a side opponent needs ${Math.round(body + nameAndMelds)}px but the middle ` +
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

/**
 * The menu screens lay out in TWO COLUMNS in landscape, and that split is the
 * load-bearing part — not the trimmed paddings, which only buy margin. So each
 * screen is budgeted in both directions: the taller column has to fit, and the
 * stacked-in-one-column version has to NOT fit. Without the second assertion
 * these pass whatever the numbers are, which is exactly how the first version
 * of this file went green while the table was unplayable.
 */
describe('landscape menu screens fit a phone', () => {
  const usable = PHONE_LANDSCAPE.height - 2 * tokens.space.s;

  it("the lobby's seat cards and controls fit as columns but not stacked", () => {
    const seats = 4 * COMPACT_ROW.seat + 3 * tokens.space.s;
    // Room code, Invite, the rounds row, Start, its hint and Leave.
    const controls = 30 + 13 + BUTTON * 4 + 13 + 5 * 6;

    assertAtMost(
      seats, usable,
      `four seat cards need ${seats}px of ${usable}px — the last seat would ` +
        'be unreachable, so a table could not be filled',
    );
    assertAtMost(
      controls, usable,
      `the lobby controls need ${controls}px of ${usable}px — "Leave table" ` +
        'would fall off the bottom',
    );
    assertAtLeast(
      seats + controls + tokens.space.m, usable,
      'the lobby now fits stacked in one column, so the landscape split in ' +
        'app/lobby.tsx is no longer load-bearing and this test is dead',
    );
  });

  it('the results standings and actions fit as columns but not stacked', () => {
    const board = 20 + tokens.space.xs + 4 * COMPACT_ROW.standing + 4 * tokens.space.xs;
    const actions = 13 + BUTTON * 2 + 2 * tokens.space.s;

    assertAtMost(
      board, usable,
      `the standings need ${board}px of ${usable}px — first place would be ` +
        'clipped off the top, which is the one thing this screen has to show',
    );
    assertAtMost(
      actions, usable,
      `Play again and Leave table need ${actions}px of ${usable}px`,
    );
    assertAtLeast(
      board + actions + tokens.space.m, usable,
      'results now fits stacked in one column, so the landscape split in ' +
        'app/results.tsx is no longer load-bearing and this test is dead',
    );
  });

  it('a navigation header would not fit, so the stack stays headerless', () => {
    // Proof that `headerShown: false` in app/_layout.tsx is load-bearing and
    // not just taste. The lobby's controls are the tallest column in the app;
    // add a 64px chrome bar and "Leave table" goes off the bottom again.
    const header = 64;
    const controls = 30 + 13 + BUTTON * 4 + 13 + 5 * 6;
    assertAtLeast(
      controls + header, usable,
      `the lobby controls (${controls}px) now fit WITH a ${header}px header, ` +
        'so the headerless stack is no longer load-bearing and this test is dead',
    );
    assertAtMost(controls, usable, 'and they must still fit without one');
  });
});
