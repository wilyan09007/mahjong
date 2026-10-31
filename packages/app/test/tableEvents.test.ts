import { assertEqual, assertThat } from './support';
import { addedIndices, tableEvents, type TableEvent } from '../src/state/tableEvents';
import {
  applyAction, legalActions, newHand, viewFor,
  type Action, type GameState, type PlayerView, type Seat,
} from '@mahjong/engine';

/**
 * Every animation on the table is driven by `tableEvents`, which compares the
 * last view with the new one and names what happened. These tests feed it
 * views from real engine play, never hand-built fixtures, so an event the
 * engine can produce is an event the table can show.
 */

const ME: Seat = 0;

/** One step of a greedy table: take any win, then any pung or kong, else play on. */
function step(state: GameState): GameState {
  const all = ([0, 1, 2, 3] as Seat[]).flatMap((s) => legalActions(state, s));
  const pick = (pred: (a: Action) => boolean) => all.find(pred);
  const action =
    pick((a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win')) ??
    pick((a) => a.type === 'claim' && (a.claim === 'pung' || a.claim === 'kong')) ??
    pick((a) => a.type === 'discard') ??
    pick((a) => a.type === 'pass');
  if (!action) throw new Error(`no legal action in phase ${state.phase}`);
  return applyAction(state, action);
}

/** Play from `seed` and collect (before, after) pairs from my seat's view. */
function transitions(seed: number, limit = 400): [PlayerView, PlayerView][] {
  let state = newHand({ seed, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  const out: [PlayerView, PlayerView][] = [];
  for (let i = 0; i < limit && !state.result; i++) {
    const before = viewFor(state, ME);
    state = step(state);
    out.push([before, viewFor(state, ME)]);
  }
  return out;
}

const kinds = (events: TableEvent[]) => events.map((e) => e.type);

describe('addedIndices', () => {
  it('finds the newcomer in a sorted hand, wherever it sorted to', () => {
    expect(addedIndices(['1w', '3w', '5t'], ['1w', '2w', '3w', '5t'])).toEqual([1]);
  });
  it('counts copies: a second 5t is new even though a 5t was there', () => {
    expect(addedIndices(['5t', '7t'], ['5t', '5t', '7t'])).toEqual([1]);
  });
  it('finds nothing when tiles only left', () => {
    expect(addedIndices(['1w', '2w', '3w'], ['1w', '3w'])).toEqual([]);
  });
});

describe('tableEvents', () => {
  it('deals when a hand opens, and only then', () => {
    const opening = viewFor(newHand({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 'E' }), ME);
    expect(kinds(tableEvents(null, opening))).toEqual(['deal']);
    // Reconnecting mid-hand is not a deal: tiles are already on the table.
    const mid = transitions(3).find(([, after]) => after.discards.length > 2)![1];
    assertThat(!kinds(tableEvents(null, mid)).includes('deal'), 'a reconnect replayed the deal');
  });

  it('reports my draw as the tile that arrived', () => {
    const pairs = transitions(11);
    const draw = pairs.find(([b, a]) => a.hand.length > b.hand.length && a.discards.length > 0);
    assertThat(draw !== undefined, 'seed 11 never drew a tile for me');
    const [before, after] = draw!;
    const event = tableEvents(before, after).find((e) => e.type === 'draw');
    assertThat(event?.type === 'draw', 'no draw event');
    if (event?.type !== 'draw') return;
    assertEqual(event.indices.length, 1, 'one tile drawn');
    expect(addedIndices(before.hand, after.hand)).toEqual(event.indices);
  });

  it('reports every discard, with who threw it and what', () => {
    for (const [before, after] of transitions(5)) {
      const events = tableEvents(before, after);
      const thrownBy = [{ seat: after.seat, discards: after.discards }, ...after.opponents]
        .filter((p, i) => p.discards.length >
          [before.discards, ...before.opponents.map((o) => o.discards)][i]!.length);
      for (const p of thrownBy) {
        const event = events.find((e) => e.type === 'discard' && e.seat === p.seat);
        assertThat(event !== undefined, `seat ${p.seat}'s discard went unannounced`);
        if (event?.type === 'discard') assertEqual(event.tile, p.discards.at(-1)!, 'wrong tile');
      }
    }
  });

  it('announces claimed melds with what was made', () => {
    let found = 0;
    for (let seed = 1; seed < 40 && found === 0; seed++) {
      for (const [before, after] of transitions(seed)) {
        for (const e of tableEvents(before, after)) {
          if (e.type !== 'claim') continue;
          found++;
          const melds = e.seat === after.seat
            ? after.melds
            : after.opponents.find((o) => o.seat === e.seat)!.melds;
          assertEqual(e.meld, melds.at(-1)!.type, 'claim names the wrong meld');
        }
      }
    }
    assertThat(found > 0, 'no seed in 1..39 produced a claim to check');
  });

  it('announces the win exactly once, for the winner', () => {
    for (let seed = 1; seed < 60; seed++) {
      const pairs = transitions(seed);
      const last = pairs.at(-1)!;
      if (last[1].result?.type !== 'win') continue;
      const wins = pairs.flatMap(([b, a]) => tableEvents(b, a)).filter((e) => e.type === 'win');
      assertEqual(wins.length, 1, `seed ${seed}: win announced ${wins.length} times`);
      if (wins[0]!.type === 'win') assertEqual(wins[0]!.seat, last[1].result.winner, 'wrong winner');
      return;
    }
    throw new Error('no seed in 1..59 ended in a win');
  });

  it('is quiet when nothing changed', () => {
    const before = transitions(2)[0]![0];
    expect(tableEvents(before, before)).toEqual([]);
  });
});
