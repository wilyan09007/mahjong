import { assertAtMost, assertAtLeast, assertThat } from './support';
import { MELD_ROW, handTileWidth, meldRowWidth } from '../src/components/Board';
import { actionRowHeight, layoutActionRow } from '../src/state/actionRow';
import { CHIP_HIT_SLOP, CHIP_ROW } from '../src/components/RuleChips';
import { POND, feltSize, pondBlock, pondLayout } from '../src/state/tableLayout';
import {
  COMPACT_ROW, PHONE_LANDSCAPE, SIDE_STACK, TABLE_ZONES, TILE_SIZES,
  sideStackColumns, tileHeight, tokens,
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

/**
 * A side seat's overlapping stack: the near tile of each column in full, then a
 * step per tile behind it. Height is set by the TALLEST column.
 */
function sideStackHeight(tiles: number): number {
  const tallest = Math.max(...sideStackColumns(tiles));
  const breaks = Math.floor((tallest - 1) / SIDE_STACK.groupSize);
  return tallest * sideTileHeight()
    + (tallest - 1) * SIDE_STACK.gap
    + breaks * SIDE_STACK.groupGap;
}

/** A laid-down tile is as tall as an upright one is wide: the ratio inverts. */
function sideTileHeight(): number {
  return SIDE_STACK.tileWidth * tokens.tile.aspect;
}

/** Width of the stack itself: one laid-down tile per column, plus the gaps. */
const SIDE_STACK_WIDTH = SIDE_STACK.columns * SIDE_STACK.tileWidth
  + (SIDE_STACK.columns - 1) * SIDE_STACK.gap;

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
    const melds = MELD_ROW;
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

  it('an ordinary claim window fits one row above the hand, at full size', () => {
    // The buttons share the row above my tiles with my melds. The common
    // windows — a pung offer, a win offer, a few chow options — must fit there
    // whole, without shrinking, on the smallest phone.
    const row = PHONE_LANDSCAPE.width - 2 * tokens.space.s;
    const meld = (n: number) => Array.from({ length: n }, () => ({ tiles: ['1w', '1w', '1w'] })) as never;
    const cases: [string, { label: string; tiles: number }[], number][] = [
      ['pung or pass, two melds down', [{ label: 'Pass', tiles: 0 }, { label: '碰', tiles: 0 }], 2],
      ['win, pung or pass, two melds down',
        [{ label: 'Pass', tiles: 0 }, { label: '碰', tiles: 0 }, { label: '胡', tiles: 0 }], 2],
      ['three chows and a pung, no melds',
        [{ label: 'Pass', tiles: 0 }, ...Array(3).fill({ label: '吃', tiles: 3 }), { label: '碰', tiles: 0 }], 0],
    ];
    for (const [name, buttons, melds] of cases) {
      const layout = layoutActionRow(buttons, row - meldRowWidth(meld(melds)) - tokens.space.s);
      assertThat(layout.rows.length === 1, `${name}: wrapped onto ${layout.rows.length} rows`);
      if (melds > 0 || buttons.length < 4) assertThat(layout.size === 'regular', `${name}: shrank to ${layout.size}`);
    }
  });

  it('the busiest claim window rises no further than my half of the table', () => {
    // Four melds down and every claim on offer at once: the worst case. The
    // rows may rise over my own discards — never past the middle of the felt
    // into the pond across.
    const row = PHONE_LANDSCAPE.width - 2 * tokens.space.s;
    const melds = Array.from({ length: 4 }, () => ({ tiles: ['1w', '1w', '1w'] })) as never;
    const buttons = [
      { label: 'Pass', tiles: 0 }, ...Array(3).fill({ label: '吃', tiles: 3 }),
      { label: '碰', tiles: 0 }, { label: '槓', tiles: 1 }, { label: '胡', tiles: 0 },
    ];
    const layout = layoutActionRow(buttons, row - meldRowWidth(melds) - tokens.space.s);
    const rise = actionRowHeight(layout.rows.length, layout.size) - MELD_ROW;
    const half = feltSize(PHONE_LANDSCAPE).height / 2;
    assertAtMost(rise, half,
      `${layout.rows.length} rows of buttons rise ${rise}px over a felt whose lower half is ${half}px`);
  });

  it('a full 17-tile hand fits across the screen, at every width', () => {
    // Nothing sits beside the hand any more — the action buttons moved into
    // the row above it — so the hand has the full width less the padding.
    for (const screen of [PHONE_LANDSCAPE.width, 711, 800, 880, 1100]) {
      const available = screen - 2 * tokens.space.s;
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
    // The reference phone must not need to shrink at all.
    const onPhone = PHONE_LANDSCAPE.width - 2 * tokens.space.s;
    assertThat(
      handTileWidth(onPhone, 17) === TILE_SIZES.hand,
      `the ${PHONE_LANDSCAPE.width}px phone shrinks hand tiles to ${handTileWidth(onPhone, 17)}px`,
    );
    assertAtLeast(
      handTileWidth(711 - 2 * tokens.space.s, 17), 32,
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

  it('every seat’s pond holds a full hand’s discards, on the felt, at any size', () => {
    // 18 is the most any seat threw across 3000 simulated hands. The ponds sit
    // in front of their owners and must hold that many without leaving the
    // felt — on the smallest phone at a size you can still read.
    for (const screen of [
      PHONE_LANDSCAPE, { width: 711, height: 400 }, { width: 880, height: 400 }, { width: 1100, height: 500 },
    ]) {
      const felt = feltSize(screen);
      const { tile, mats } = pondLayout(felt);
      for (const [edge, m] of Object.entries(mats)) {
        assertThat(
          m.x >= 0 && m.y >= 0 && m.x + m.width <= felt.width && m.y + m.height <= felt.height,
          `${screen.width}x${screen.height}: the ${edge} pond leaves the felt`,
        );
      }
      assertAtLeast(tile, 18, `${screen.width}x${screen.height}: discards shrink to ${tile}px`);
    }
    assertAtLeast(pondLayout(feltSize(PHONE_LANDSCAPE)).tile, 21,
      'on the reference phone discards are smaller than the 21px they were designed at');
    assertAtLeast(POND.capacity, 18, 'a pond no longer holds the worst hand seen');
  });

  it('discard size follows the felt, because no fixed size fits every screen', () => {
    // Proof the sizing is load-bearing: the old fixed 24px discard does not fit
    // four full ponds on the reference phone's felt...
    const felt = feltSize(PHONE_LANDSCAPE);
    const tall24 = 2 * (pondBlock('bottom', 24).height + 2 * POND.matPad + POND.rimPad) + POND.centreGap;
    assertAtLeast(tall24, felt.height + 1,
      'a fixed 24px discard now fits the small phone — the felt-driven size is not needed');
    // ...and a size that fits there would waste a large screen's felt.
    assertThat(pondLayout(feltSize({ width: 1100, height: 500 })).tile > pondLayout(felt).tile,
      'a large screen draws discards no bigger than a small one');
  });

  it("a side opponent's 17 concealed tiles fit their rail", () => {
    // THE constraint that forced the edge-on design. Rendered as full mini tile
    // backs, 17 of them stack ~186px deep, which is what drove the side panels
    // straight through the middle of the table.
    //
    // Measured against the RAIL, not the middle band: the side seats are not
    // confined to the band, because the top zone's corners are empty. That
    // reclaimed height is what pays for a 6px sliver instead of a 4px slit.
    const middle = PHONE_LANDSCAPE.height - TABLE_ZONES.railTop - TABLE_ZONES.bottom;
    const stack = sideStackHeight(17);
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

  it("a side opponent's exposed melds fit the rim beside their stack", () => {
    // The rim exists at this width so exposed melds can be drawn at a size you
    // can actually read. Squeezed narrower they had to shrink to 13px, which
    // was illegible; drawn at full size in a narrow rim they ran 31px off the
    // screen. Both failures were real, so both directions are budgeted.
    const chrome = 2 * tokens.space.xs + 2 * 2;
    const needed = SIDE_STACK_WIDTH + 2 + 3 * (TILE_SIZES.mini + 1) + chrome;
    assertAtMost(
      needed, TABLE_ZONES.side,
      `a side panel needs ${needed}px but the rim is ${TABLE_ZONES.side}px — ` +
        'their melds would spill onto the felt or off the screen',
    );
    assertAtLeast(
      TILE_SIZES.mini, 16,
      'exposed melds on the rim are too small to identify, which is the whole ' +
        'reason they are drawn at all',
    );
    // And the rim must not eat so much width that the ponds stop fitting.
    assertAtLeast(
      pondLayout(feltSize(PHONE_LANDSCAPE)).tile, 21,
      `the rim at ${TABLE_ZONES.side}px squeezes the discards below 21px`,
    );
  });

  it("a side opponent's tiles are laid down, whole, and grouped in fours", () => {
    // Laid down, not upright: those players' tiles face them, so from your seat
    // they are turned ninety degrees.
    assertAtLeast(
      SIDE_STACK.tileWidth, sideTileHeight(),
      'a side seat’s tiles are taller than they are wide, so they are drawn ' +
        'standing up — from your seat those tiles are lying down',
    );

    // Nothing overlaps: every tile is drawn whole with felt around it. That is
    // only possible BECAUSE they are laid down — upright they are 24.5px each
    // and 9 of them would not fit the rail.
    const upright = 9 * tileHeight(TILE_SIZES.mini) + 8 * SIDE_STACK.gap
      + 2 * SIDE_STACK.groupGap;
    const budget = PHONE_LANDSCAPE.height - TABLE_ZONES.railTop - TABLE_ZONES.bottom
      - 16 - 2 * tokens.space.xs - 2 * 2;
    assertAtLeast(
      upright, budget,
      `a column of 9 upright tiles is ${Math.round(upright)}px and now fits the ` +
        `${Math.round(budget)}px budget, so laying them down is no longer what ` +
        'makes them fit whole',
    );
    assertAtMost(
      sideStackHeight(17), budget,
      `a column of laid-down tiles is ${Math.round(sideStackHeight(17))}px in a ` +
        `${Math.round(budget)}px budget`,
    );

    assertAtMost(
      SIDE_STACK.groupSize, 5,
      'groups larger than five defeat the point — counting a group of six ' +
        'is the same problem as counting seventeen',
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

  it('the ruleset picker and Hong Kong options fit under the seats', () => {
    // The controls column is full, so the house rules ride under the seat
    // cards as chip rows: the ruleset, then two rows of Hong Kong options.
    const seats = 4 * COMPACT_ROW.seat + 3 * tokens.space.s;
    const rules = tokens.space.s + 3 * CHIP_ROW + 2 * 6;
    assertAtMost(seats + rules, usable,
      `seats (${seats}) and the rules rows (${rules}) need ${seats + rules}px of ${usable}px`);
    // A chip draws small but is touched at full size.
    assertAtLeast(CHIP_ROW + 2 * CHIP_HIT_SLOP, tokens.hitSlop - 2, 'rule chips are too small to tap');
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
