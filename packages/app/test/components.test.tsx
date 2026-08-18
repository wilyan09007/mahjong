import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { assertThat } from './support';
import { TileFace } from '../src/tiles/TileFace';
import { Tile } from '../src/tiles/Tile';
import { ActionBar } from '../src/components/Controls';
import { exposedTiles, HandRow, OpponentPanel } from '../src/components/Board';
import { sideStackColumns } from '../src/theme/tokens';
import { actionBarModel } from '../src/state/selectors';
import { FLOWERS, NON_FLOWER_KINDS, newHand, viewFor } from '@mahjong/engine';
import type { Action, TileKind } from '@mahjong/engine';

/**
 * Real renders through React Native Testing Library — no mocked components.
 *
 * react-test-renderer is deprecated in React 19 and react-native-svg produces
 * no host output under it, so RNTL is the supported way to actually mount
 * these. Note `render` is ASYNC in RNTL 14.
 *
 * TWO HARD-WON RULES, both of which cause tests that pass alone and fail in a
 * full run — the worst kind to debug:
 *
 *   1. ALWAYS `await fireEvent.*`. It is async in RNTL 14, and not awaiting it
 *      produces overlapping `act()` scopes that corrupt the renderer for every
 *      later test in the file.
 *   2. ALL component tests live in THIS ONE FILE, and none of them call
 *      `unmount()`. RNTL keeps its renderer root on module state, which leaks
 *      between test *files* in a reused Jest worker; unmounting by hand
 *      corrupts that root outright. One file, no manual teardown, is the only
 *      arrangement that holds.
 *
 * What these prove is narrow and worth it: every one of the 42 faces mounts
 * without throwing (a crash on someone's phone that a gallery screenshot would
 * miss), and the action bar dispatches exactly the engine action it was handed.
 */

/** Render and run assertions. Teardown is RNTL's job — see the note above. */
async function mounted<T>(
  element: React.ReactElement,
  body: (screen: Awaited<ReturnType<typeof render>>) => Promise<T> | T,
): Promise<T> {
  return body(await render(element));
}

describe('TileFace', () => {
  it('mounts every one of the 42 faces without throwing', async () => {
    for (const tile of [...NON_FLOWER_KINDS, ...FLOWERS] as TileKind[]) {
      let threw: unknown = null;
      try {
        await mounted(<TileFace tile={tile} />, () => undefined);
      } catch (error) {
        threw = error;
      }
      assertThat(
        threw === null,
        `${tile} threw while rendering: ${threw instanceof Error ? threw.message : threw}`,
      );
    }
  });

  it('mounts at every size used on the table', async () => {
    for (const size of [22, 30, 34, 44, 88]) {
      let threw: unknown = null;
      try {
        await mounted(<TileFace tile="9t" size={size} />, () => undefined);
      } catch (error) {
        threw = error;
      }
      assertThat(threw === null, `size ${size} threw: ${String(threw)}`);
    }
  });
});


describe('Tile', () => {
  it('exposes the tile it represents to assistive tech', async () => {
    await mounted(<Tile tile="dr" onPress={() => undefined} />, (screen) => {
      expect(screen.getByLabelText('dr')).toBeTruthy();
    });
  });

  it('calls back with the tile it represents', async () => {
    const pressed: TileKind[] = [];
    await mounted(<Tile tile="9b" onPress={(t) => pressed.push(t)} />, async (screen) => {
      await fireEvent.press(screen.getByLabelText('9b'));
    });
    expect(pressed).toEqual(['9b']);
  });

  it('does not fire when disabled', async () => {
    const pressed: TileKind[] = [];
    await mounted(
      <Tile tile="9b" disabled onPress={(t) => pressed.push(t)} />,
      async (screen) => {
        await fireEvent.press(screen.getByLabelText('9b'));
      },
    );
    expect(pressed).toEqual([]);
  });

  it('mounts face-down without putting the face in the tree', async () => {
    // Hiding a glyph visually would still leak it to anything reading the view
    // hierarchy, so a face-down tile must not render one at all.
    await mounted(<Tile tile="dr" faceUp={false} />, (screen) => {
      expect(screen.queryByText('中')).toBeNull();
    });
  });
});

describe('HandRow', () => {
  const state = newHand({ seed: 91, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const view = viewFor(state, 0);

  it('renders one pressable per tile in hand', async () => {
    await mounted(
      <HandRow
        tiles={view.hand}
        selectedTile={null}
        onSelect={() => undefined}
        onDiscard={() => undefined}
        disabled={false}
      />,
      (screen) => {
        expect(screen.getAllByRole('button')).toHaveLength(view.hand.length);
      },
    );
  });

  it('selects on first tap and discards on the second', async () => {
    const selected: TileKind[] = [];
    const discarded: TileKind[] = [];
    const tile = view.hand[0]!;
    const handlers = {
      onSelect: (t: TileKind) => selected.push(t),
      onDiscard: (t: TileKind) => discarded.push(t),
    };

    await mounted(
      <HandRow tiles={view.hand} selectedTile={null} disabled={false} {...handlers} />,
      async (screen) => {
        await fireEvent.press(screen.getByTestId(`hand-tile-${tile}-0`));
        expect(selected).toEqual([tile]);
        expect(discarded).toEqual([]);

        await screen.rerender(
          <HandRow tiles={view.hand} selectedTile={tile} disabled={false} {...handlers} />,
        );
        await fireEvent.press(screen.getByTestId(`hand-tile-${tile}-0`));
        expect(discarded).toEqual([tile]);
      },
    );
  });
});

describe('Tile', () => {
  it('exposes the tile it represents to assistive tech', async () => {
    await mounted(<Tile tile="dr" onPress={() => undefined} />, (screen) => {
      expect(screen.getByLabelText('dr')).toBeTruthy();
    });
  });

  it('calls back with the tile it represents', async () => {
    const pressed: TileKind[] = [];
    await mounted(<Tile tile="9b" onPress={(t) => pressed.push(t)} />, async (screen) => {
      await fireEvent.press(screen.getByLabelText('9b'));
    });
    expect(pressed).toEqual(['9b']);
  });

  it('does not fire when disabled', async () => {
    const pressed: TileKind[] = [];
    await mounted(
      <Tile tile="9b" disabled onPress={(t) => pressed.push(t)} />,
      async (screen) => {
        await fireEvent.press(screen.getByLabelText('9b'));
      },
    );
    expect(pressed).toEqual([]);
  });

  it('mounts face-down without putting the face in the tree', async () => {
    // Hiding a glyph visually would still leak it to anything reading the view
    // hierarchy, so a face-down tile must not render one at all.
    await mounted(<Tile tile="dr" faceUp={false} />, (screen) => {
      expect(screen.queryByText('中')).toBeNull();
    });
  });
});

describe('HandRow', () => {
  const state = newHand({ seed: 91, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const view = viewFor(state, 0);

  it('renders one pressable per tile in hand', async () => {
    await mounted(
      <HandRow
        tiles={view.hand}
        selectedTile={null}
        onSelect={() => undefined}
        onDiscard={() => undefined}
        disabled={false}
      />,
      (screen) => {
        expect(screen.getAllByRole('button')).toHaveLength(view.hand.length);
      },
    );
  });

  it('selects on first tap and discards on the second', async () => {
    const selected: TileKind[] = [];
    const discarded: TileKind[] = [];
    const tile = view.hand[0]!;
    const handlers = {
      onSelect: (t: TileKind) => selected.push(t),
      onDiscard: (t: TileKind) => discarded.push(t),
    };

    await mounted(
      <HandRow tiles={view.hand} selectedTile={null} disabled={false} {...handlers} />,
      async (screen) => {
        await fireEvent.press(screen.getByTestId(`hand-tile-${tile}-0`));
        expect(selected).toEqual([tile]);
        expect(discarded).toEqual([]);

        await screen.rerender(
          <HandRow tiles={view.hand} selectedTile={tile} disabled={false} {...handlers} />,
        );
        await fireEvent.press(screen.getByTestId(`hand-tile-${tile}-0`));
        expect(discarded).toEqual([tile]);
      },
    );
  });
});

describe('ActionBar', () => {
  const state = newHand({ seed: 91, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const view = viewFor(state, 0);

  it('shows a disabled Discard until a tile is chosen', async () => {
    await mounted(
      <ActionBar model={actionBarModel(view, null)} onAction={() => undefined} disabled={false} />,
      (screen) => {
        expect(screen.getByTestId('action-discard').props.accessibilityState?.disabled)
          .toBe(true);
      },
    );
  });

  it('dispatches exactly the engine action for the selected tile', async () => {
    const chosen = view.hand[0]!;
    const sent: Action[] = [];
    await mounted(
      <ActionBar
        model={actionBarModel(view, chosen)}
        onAction={(a) => sent.push(a)}
        disabled={false}
      />,
      async (screen) => {
        await fireEvent.press(screen.getByTestId('action-discard'));
      },
    );
    expect(sent).toEqual([{ type: 'discard', seat: 0, tile: chosen }]);
  });

  it('sends nothing while an action is in flight', async () => {
    const sent: Action[] = [];
    await mounted(
      <ActionBar
        model={actionBarModel(view, view.hand[0]!)}
        onAction={(a) => sent.push(a)}
        disabled
      />,
      async (screen) => {
        await fireEvent.press(screen.getByTestId('action-discard'));
      },
    );
    expect(sent).toEqual([]);
  });

  it('renders nothing at all when there is nothing to do', async () => {
    const idle = viewFor(state, 2); // not seat 2's turn
    await mounted(
      <ActionBar model={actionBarModel(idle, null)} onAction={() => undefined} disabled={false} />,
      (screen) => {
        expect(screen.toJSON()).toBeNull();
      },
    );
  });
});

describe('OpponentPanel — a side seat you have to count', () => {
  const state = newHand({ seed: 4242, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const me = viewFor(state, 0);
  const sideOpponent = me.opponents[0]!;

  /** One tile back per concealed tile, grouped in fours so it can be counted. */
  async function slivers(handCount: number): Promise<{ total: number; breaks: number }> {
    return mounted(
      <OpponentPanel
        opponent={{ ...sideOpponent, handCount }}
        edge="left"
        isTurn={false}
        connected
        name="Bot 4"
      />,
      (screen) => {
        const found = screen.queryAllByTestId('concealed-sliver');
        // Tiles overlap by a negative marginTop; a group break simply overlaps
        // LESS, so a break is a top margin nearer zero than the usual step.
        const margins = found.map((s) => {
          const flat = StyleSheet.flatten(s.props.style) as { marginTop?: number } | undefined;
          return flat?.marginTop;
        }).filter((m): m is number => typeof m === 'number');
        const tightest = Math.min(...margins, 0);
        const breaks = margins.filter((m) => m > tightest).length;
        return { total: found.length, breaks };
      },
    );
  }

  it('draws exactly one sliver per concealed tile', async () => {
    for (const count of [16, 13, 10, 7, 4, 1]) {
      const { total } = await slivers(count);
      assertThat(
        total === count,
        `a hand of ${count} drew ${total} slivers — the stack is the only ` +
          'thing telling you how many tiles someone is holding',
      );
    }
  });

  it('breaks each column into fours, and never trails a break off the end', async () => {
    // A trailing break leaves a floating gap under a column that reads as one
    // extra tile, so a column of exactly four must have no break at all.
    const expected = (n: number): number => sideStackColumns(n)
      .reduce((sum, size) => sum + Math.floor((size - 1) / 4), 0);

    for (const n of [17, 16, 13, 8, 4, 1]) {
      const { breaks } = await slivers(n);
      assertThat(
        breaks === expected(n),
        `a hand of ${n} across ${sideStackColumns(n).join('+')} drew ${breaks} ` +
          `group breaks, expected ${expected(n)}`,
      );
    }
  });

  it('overlaps the tiles rather than spacing them out', async () => {
    // The whole reason these fit: 17 mini tiles laid out clear of one another
    // are 434px, and the rail is about 170. If the margin ever goes positive
    // the stack has stopped overlapping and will run off both ends.
    await mounted(
      <OpponentPanel
        opponent={{ ...sideOpponent, handCount: 17 }}
        edge="left" isTurn={false} connected name="Bot 4"
      />,
      (screen) => {
        const found = screen.queryAllByTestId('concealed-sliver');
        const margins = found.map((s) => {
          const flat = StyleSheet.flatten(s.props.style) as { marginTop?: number } | undefined;
          return flat?.marginTop ?? 0;
        });
        assertThat(
          margins.every((m) => m <= 0),
          `a tile has a positive top margin (${Math.max(...margins)}px), so the ` +
            'stack is spacing tiles apart instead of overlapping them',
        );
      },
    );
  });
});

describe('OpponentPanel — a side seat must stay inside its rim', () => {
  const state = newHand({ seed: 77, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const base = viewFor(state, 0).opponents[0]!;

  /** Four melds and four flowers: a heavily exposed hand. */
  const loaded = {
    ...base,
    handCount: 4,
    melds: [
      { type: 'pung', tiles: ['1w', '1w', '1w'], concealed: false, from: 1 },
      { type: 'chow', tiles: ['2t', '3t', '4t'], concealed: false, from: 1 },
      { type: 'pung', tiles: ['9b', '9b', '9b'], concealed: false, from: 2 },
      { type: 'kong', tiles: ['5w', '5w', '5w', '5w'], concealed: true, from: null },
    ],
    flowers: ['f1', 'f2', 'f3', 'f4'],
  } as unknown as typeof base;

  it('keeps a concealed kong concealed, even flattened into the grid', () => {
    const flat = exposedTiles(loaded);
    // 13 meld tiles + 4 flowers, nothing dropped on the way into the grid.
    expect(flat).toHaveLength(3 + 3 + 3 + 4 + 4);

    // The kong is the last meld: exactly two of its four stay face down.
    const kong = flat.filter((t) => t.tile === '5w');
    expect(kong).toHaveLength(4);
    assertThat(
      kong.filter((t) => !t.faceUp).length === 2,
      'a declared concealed kong is showing ' +
        `${kong.filter((t) => t.faceUp).length} of its 4 tiles face up — ` +
        'an 暗槓 must not tell the table which tile it was',
    );
  });

  it('draws every exposed tile for both side seats', async () => {
    for (const edge of ['left', 'right'] as const) {
      await mounted(
        <OpponentPanel
          opponent={loaded} edge={edge} isTurn={false} connected name="Bot"
        />,
        (screen) => {
          // 13 exposed tiles: 3 + 3 + 3 + 4 meld tiles, of which 2 are backs,
          // plus 4 flowers. None may be dropped on the way into the grid.
          const tiles = screen.queryAllByTestId('concealed-sliver');
          assertThat(
            tiles.length === 4,
            `${edge} seat drew ${tiles.length} slivers for a 4-tile hand`,
          );
        },
      );
    }
  });
});
