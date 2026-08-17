import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { assertThat } from './support';
import { TileFace } from '../src/tiles/TileFace';
import { Tile } from '../src/tiles/Tile';
import { ActionBar } from '../src/components/Controls';
import { HandRow, OpponentPanel } from '../src/components/Board';
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

  /** One sliver per tile, grouped in fours so the column can be counted. */
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
        const breaks = found.filter((s) => {
          const flat = StyleSheet.flatten(s.props.style) as { marginBottom?: number };
          return (flat.marginBottom ?? 0) > 0;
        }).length;
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

  it('breaks the column into fours, and never trails a break off the end', async () => {
    // 16 tiles is 4|4|4|4 — three breaks, not four. A trailing break leaves a
    // floating gap under the stack that reads as a seventeenth tile.
    expect((await slivers(16)).breaks).toBe(3);
    // 13 after a pung is 4|4|4|1: the remainder still gets its own group.
    expect((await slivers(13)).breaks).toBe(3);
    expect((await slivers(8)).breaks).toBe(1);
    expect((await slivers(4)).breaks).toBe(0);
    expect((await slivers(1)).breaks).toBe(0);
  });
});
