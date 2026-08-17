import { assertAtMost, assertAtLeast, assertThat } from './support';
import { handTileWidth, pondColumns } from '../src/components/Board';
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

  it('my melds, hand and the strip beneath it fit the bottom zone', () => {
    // The action bar is NOT in this sum. It stacks up the right-hand side
    // above the hand; when it shared the bottom zone it landed on the same
    // line as the emote row and the two drew over each other. Its old space is
    // what the melds row now occupies.
    //
    // Flowers and emotes share ONE strip below the hand, in opposite corners,
    // so the zone pays for the taller of them once rather than a row each.
    const melds = 40;
    const handRow = tileHeight(TILE_SIZES.hand) + 10; // tiles lift 10px when selected
    const strip = Math.max(tileHeight(TILE_SIZES.mini), 22 + 2 * tokens.space.xs);
    const total = melds + handRow + strip;
    assertAtMost(
      total, TABLE_ZONES.bottom,
      `melds (${melds}) + hand (${Math.round(handRow)}) + the strip under it ` +
        `(${Math.round(strip)}) = ${Math.round(total)}px in a ` +
        `${TABLE_ZONES.bottom}px zone`,
    );
    assertAtLeast(
      melds, tileHeight(TILE_SIZES.meld),
      'the melds row is shorter than a meld tile, so completed sets would be ' +
        'clipped in the one place they are meant to be readable',
    );
  });

  it('my flowers fit the corner they share with the emotes', () => {
    // All eight flowers is the extreme, and they must stay on one row: the
    // strip clips at mini-tile height and a wrapped second row would vanish.
    const flowers = 8 * (TILE_SIZES.mini + tokens.space.xs);
    const emotes = 8 * (22 + 2 * tokens.space.xs);
    assertAtMost(
      flowers + emotes, PHONE_LANDSCAPE.width,
      `eight flowers (${Math.round(flowers)}px) plus the emote row ` +
        `(${emotes}px) overrun a ${PHONE_LANDSCAPE.width}px strip`,
    );
  });

  it('the action stack clears the right player instead of covering their tiles', () => {
    // Found by measuring the live table, not by looking at it: anchored into
    // the middle band the stack clipped the corner of the right player's panel
    // by 60x8px, covering the last of the very tile slivers that panel exists
    // to let you count. It now stops above the emote row instead.
    const band = PHONE_LANDSCAPE.height - TABLE_ZONES.top - TABLE_ZONES.bottom;
    const panel = 17 * EDGE_ON_TILE.height + 16 * EDGE_ON_TILE.gap
      + Math.floor(16 / EDGE_ON_TILE.groupSize) * EDGE_ON_TILE.groupGap
      + 16 + 2 * tokens.space.xs + 2 * 2;
    // Side panels are centred in the band, so this is where one ends.
    const panelBottom = TABLE_ZONES.top + (band + panel) / 2;

    const stackTop = (buttons: number): number => PHONE_LANDSCAPE.height
      - TABLE_ZONES.emoteRow
      - (buttons * tokens.hitSlop + (buttons - 1) * tokens.space.s);

    // Two — a claim and Pass — is the ordinary claim window, and it must clear.
    assertAtLeast(
      stackTop(2), panelBottom,
      `a two-button stack starts at ${Math.round(stackTop(2))}px but the side ` +
        `panel runs to ${Math.round(panelBottom)}px, so it would cover their tiles`,
    );
    // And it must never reach the emote row below it.
    assertAtMost(
      TABLE_ZONES.emoteRow + tokens.hitSlop, TABLE_ZONES.bottom,
      'the action stack and the emote row would overlap again',
    );
    // Three or more DOES overlap. Recorded, not asserted away: in that moment
    // the buttons matter more than the tile count, and the window is brief.
    assertThat(
      stackTop(3) < panelBottom,
      'three actions now clear the side panel too — this note is out of date',
    );
  });

  it('a full 17-tile hand fits beside the action stack, at every width', () => {
    // Not just "fits the screen": the hand has to fit the screen MINUS the
    // gutter the action stack occupies. At 711px, 17 tiles at full size take
    // 91% of the width, and the Discard button sat on top of the last few
    // tiles of the hand you were choosing between.
    for (const screen of [PHONE_LANDSCAPE.width, 711, 800, 880, 1100]) {
      const available = screen - 2 * tokens.space.s - TABLE_ZONES.actionGutter;
      const span = 17 * (handTileWidth(available, 17) + 2);
      assertAtMost(
        span, available,
        `at ${screen}px wide the hand spans ${span}px of the ${available}px ` +
          'left beside the action stack, so it would run under the buttons',
      );
    }
  });

  it('the hand only shrinks when it has to, and stays tappable', () => {
    const roomy = PHONE_LANDSCAPE.width * 2;
    assertThat(
      handTileWidth(roomy, 17) === TILE_SIZES.hand,
      'a wide screen is shrinking the hand for no reason',
    );
    // The target device must not need to shrink at all.
    const onTarget = 880 - 2 * tokens.space.s - TABLE_ZONES.actionGutter;
    assertThat(
      handTileWidth(onTarget, 17) === TILE_SIZES.hand,
      `the 880px target now shrinks hand tiles to ${handTileWidth(onTarget, 17)}px — ` +
        'the gutter has grown too wide for the screen it was sized for',
    );
    assertAtLeast(
      handTileWidth(711 - 2 * tokens.space.s - TABLE_ZONES.actionGutter, 17), 32,
      'tiles shrink below the 32px touch target on a 711px window',
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

  it('four discard ponds fit side by side at any width', () => {
    // Pond columns adapt to the width for exactly this reason: when four ponds
    // did not fit, the row wrapped into a 2x2 block that swelled across the
    // middle of the table and pressed up against the side seats.
    for (const width of [PHONE_LANDSCAPE.width, 711, 800, 880, 1100]) {
      const centre = width - 2 * tokens.space.s - 2 * TABLE_ZONES.side;
      const total = 4 * pondColumns(width) * (TILE_SIZES.discard + 1) + 3 * tokens.space.s;
      assertAtMost(
        total, centre,
        `at ${width}px wide the four ponds span ${total}px of ${centre}px ` +
          'between the seats, so they would wrap into the side players',
      );
    }
  });

  it("a side opponent's 17 concealed tiles fit the middle band", () => {
    // THE constraint that forced the edge-on design. Rendered as full mini tile
    // backs, 17 of them stack ~186px deep in a ~152px band, which is what drove
    // the side panels straight through the middle of the table.
    const middle = PHONE_LANDSCAPE.height - TABLE_ZONES.top - TABLE_ZONES.bottom;
    // 17 slivers, 16 gaps, and an extra break after every fourth tile.
    const stack = 17 * EDGE_ON_TILE.height
      + 16 * EDGE_ON_TILE.gap
      + Math.floor(16 / EDGE_ON_TILE.groupSize) * EDGE_ON_TILE.groupGap;
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

  it("a side opponent's tiles are grouped so they can be counted", () => {
    // The functional requirement, not decoration: you play differently against
    // someone holding 16 than someone holding 13, and an unbroken column of 17
    // identical 4px bars cannot be counted at a glance. Groups must be visibly
    // further apart than the tiles inside them, or the grouping does nothing.
    assertAtLeast(
      EDGE_ON_TILE.groupGap, EDGE_ON_TILE.gap * 2,
      `a ${EDGE_ON_TILE.groupGap}px break between groups against ` +
        `${EDGE_ON_TILE.gap}px between tiles is not a visible group boundary`,
    );
    assertAtMost(
      EDGE_ON_TILE.groupSize, 5,
      'groups larger than five defeat the point — counting a group of six ' +
        'is the same problem as counting seventeen',
    );
    // And the sliver has to be more than a bar: it carries a strip of the
    // tile's ivory body, which is also what separates it from its neighbour.
    assertAtLeast(EDGE_ON_TILE.faceEdge, 1, 'the tile face strip has vanished');
    assertAtMost(
      EDGE_ON_TILE.faceEdge, EDGE_ON_TILE.height / 2,
      'the ivory strip is half the sliver or more, so it reads as an ivory ' +
        'bar rather than a tile back with its body showing',
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
