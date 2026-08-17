import { assertThat } from './support';
import {
  actionBarModel, canStart, formatResult, medalFor, rankStandings,
} from '../src/state/selectors';
import { applyAction, legalActions, newHand, viewFor } from '@mahjong/engine';
import type { GameState, PlayerView, Seat } from '@mahjong/engine';
import type { LobbyMessage } from '../src/net/messages';

const NAMES: Record<number, string> = { 0: 'Ann', 1: 'Bo', 2: 'Cy', 3: 'Di' };

function lobbyWith(
  kinds: ('human' | 'bot' | 'empty')[],
  hostPlayerId: string | null = 'p1',
): LobbyMessage {
  return {
    code: 'ABC234',
    hostPlayerId,
    config: {
      totalRounds: 1, base: 3, perTai: 1,
      turnSeconds: 30, claimSeconds: 7, botDelayMs: 700, interHandMs: 5000,
    },
    seats: kinds.map((kind, i) => ({
      seat: i as Seat,
      kind,
      name: kind === 'empty' ? null : NAMES[i]!,
      connected: kind !== 'empty',
    })),
  };
}

describe('canStart', () => {
  it('allows the host once all four seats are filled', () => {
    expect(canStart(lobbyWith(['human', 'bot', 'bot', 'bot']), 'p1')).toEqual({ ok: true });
  });
  it('refuses when a seat is empty, and says why', () => {
    const result = canStart(lobbyWith(['human', 'bot', 'bot', 'empty']), 'p1');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/four seats/i);
  });
  it('refuses a non-host', () => {
    const result = canStart(lobbyWith(['human', 'bot', 'bot', 'bot']), 'someone-else');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/host/i);
  });
  it('refuses when there is no lobby at all', () => {
    expect(canStart(null, 'p1').ok).toBe(false);
  });
});

describe('actionBarModel', () => {
  const opening = newHand({ seed: 77, dealer: 0, dealerStreak: 0, roundWind: 'E' });

  it('is empty when there is nothing to do', () => {
    const idle = viewFor(opening, 1); // not seat 1's turn
    const model = actionBarModel(idle, null);
    expect(model.discard).toBeNull();
    expect(model.claims).toEqual([]);
    expect(model.pass).toBeNull();
    expect(model.win).toBeNull();
  });

  it('needs a selected tile before Discard becomes available', () => {
    const view = viewFor(opening, 0);
    const none = actionBarModel(view, null);
    expect(none.needsSelection).toBe(true);
    expect(none.discard).toBeNull();

    const chosen = view.hand[0]!;
    const withSelection = actionBarModel(view, chosen);
    expect(withSelection.discard).toEqual({ type: 'discard', seat: 0, tile: chosen });
  });

  it('offers no Discard for a tile the hand does not hold', () => {
    const view = viewFor(opening, 0);
    const notHeld = (['1w', '2w', '3w', '4w', '5w', '9b'] as const)
      .find((t) => !view.hand.includes(t))!;
    expect(actionBarModel(view, notHeld).discard).toBeNull();
  });

  it('labels one button per distinct chow option, never a single guessing 吃', () => {
    // Rig a real claim window with a three-way chow.
    const rigged: GameState = newHand({ seed: 5, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    const filler = [
      '1w', '4w', '7w', '2t', '5t', '8t', '3b', '6b', '9b',
      'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
    ] as PlayerView['hand'];
    rigged.players[0].hand = [...filler.slice(0, 15), '3w'] as PlayerView['hand'];
    rigged.players[1].hand = ['1w', '2w', '4w', '5w', ...filler.slice(3, 15)] as PlayerView['hand'];
    rigged.players[2].hand = [...filler];
    rigged.players[3].hand = [...filler];

    const opened = applyAction(rigged, { type: 'discard', seat: 0, tile: '3w' });
    const view = viewFor(opened, 1);
    const model = actionBarModel(view, null);

    // 1w2w / 2w4w / 4w5w
    expect(model.claims).toHaveLength(3);
    for (const claim of model.claims) {
      expect(claim.label).toBe('吃');
      assertThat(
        (claim.detail ?? '').length > 0,
        'a chow button must say which tiles it spends, or it is a guess',
      );
    }
    expect(new Set(model.claims.map((c) => c.detail)).size).toBe(3);
    expect(model.pass).toEqual({ type: 'pass', seat: 1 });
  });

  it('surfaces every legal action exactly once across the model', () => {
    // Whatever the engine offers must appear somewhere in the bar; a missing
    // button is a move the player simply cannot make.
    let s: GameState = newHand({ seed: 12, dealer: 0, dealerStreak: 0, roundWind: 'E' });
    let checked = 0;
    for (let step = 0; step < 60 && s.phase !== 'finished'; step++) {
      const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
      const view = viewFor(s, seat);
      const selected = view.hand[0] ?? null;
      const model = actionBarModel(view, selected);

      const surfaced = [
        ...(model.discard ? [model.discard] : []),
        ...(model.win ? [model.win.action] : []),
        ...(model.pass ? [model.pass] : []),
        ...model.claims.map((c) => c.action),
        ...model.kongs.map((k) => k.action),
      ];
      // Discards collapse into one button driven by selection, so compare the
      // non-discard actions exactly.
      const expected = view.legalActions.filter((a) => a.type !== 'discard');
      for (const action of expected) {
        assertThat(
          surfaced.some((s2) => JSON.stringify(s2) === JSON.stringify(action)),
          `action ${JSON.stringify(action)} never reached the action bar`,
        );
      }
      checked++;
      s = applyAction(s, view.legalActions[0]!);
    }
    assertThat(checked > 5, 'the action bar was never exercised');
  });
});

describe('formatResult', () => {
  it('renders an exhaustive draw plainly', () => {
    const formatted = formatResult({ type: 'draw-exhausted' }, NAMES);
    expect(formatted.title).toMatch(/draw/i);
    expect(formatted.rows).toEqual([]);
    expect(formatted.winningHand).toBeNull();
  });

  it('renders a win line by line, so the overlay teaches scoring', () => {
    const formatted = formatResult({
      type: 'win',
      winner: 1,
      by: 'discard',
      discarder: 2,
      winTile: '3w',
      tai: 3,
      breakdown: [{ name: '門清', tai: 1 }, { name: '平胡', tai: 2 }],
      payments: [0, 6, -6, 0],
      winningHand: { concealed: ['1w'], melds: [], flowers: [] },
    }, NAMES);

    expect(formatted.title).toContain('Bo');
    expect(formatted.title).toContain('3');
    expect(formatted.subtitle).toContain('Cy');
    expect(formatted.rows).toEqual([{ name: '門清', tai: 1 }, { name: '平胡', tai: 2 }]);
    // The rows must add up to the headline number, or the overlay lies.
    expect(formatted.rows.reduce((n, r) => n + r.tai, 0)).toBe(formatted.total);
    expect(formatted.payments.map((p) => p.delta)).toEqual([0, 6, -6, 0]);
    expect(formatted.payments.map((p) => p.name)).toEqual(['Ann', 'Bo', 'Cy', 'Di']);
  });

  it('says self-draw when nobody discarded into it', () => {
    const formatted = formatResult({
      type: 'win', winner: 0, by: 'self-draw', discarder: null, winTile: '5t',
      tai: 1, breakdown: [{ name: '自摸', tai: 1 }], payments: [15, -5, -5, -5],
      winningHand: { concealed: [], melds: [], flowers: [] },
    }, NAMES);
    expect(formatted.subtitle).toMatch(/self-draw/i);
  });

  it('falls back to a seat label when a name is missing', () => {
    const formatted = formatResult({ type: 'draw-exhausted' }, {});
    expect(formatted.payments).toEqual([]);
    const win = formatResult({
      type: 'win', winner: 2, by: 'self-draw', discarder: null, winTile: '5t',
      tai: 1, breakdown: [], payments: [0, 0, 0, 0],
      winningHand: { concealed: [], melds: [], flowers: [] },
    }, {});
    expect(win.title).toContain('Seat 3');
  });
});

describe('rankStandings', () => {
  it('ranks best first', () => {
    const ranked = rankStandings([
      { seat: 0, name: 'Ann', score: -10 },
      { seat: 1, name: 'Bo', score: 30 },
      { seat: 2, name: 'Cy', score: 5 },
      { seat: 3, name: 'Di', score: -25 },
    ]);
    expect(ranked.map((r) => r.name)).toEqual(['Bo', 'Cy', 'Ann', 'Di']);
    expect(ranked.map((r) => r.place)).toEqual([1, 2, 3, 4]);
  });

  it('shares a place on a tie instead of inventing a winner', () => {
    const ranked = rankStandings([
      { seat: 0, name: 'Ann', score: 10 },
      { seat: 1, name: 'Bo', score: 10 },
      { seat: 2, name: 'Cy', score: -20 },
      { seat: 3, name: 'Di', score: 0 },
    ]);
    expect(ranked.map((r) => r.place)).toEqual([1, 1, 3, 4]);
  });

  it('does not mutate its input', () => {
    const input = [
      { seat: 0 as Seat, name: 'Ann', score: 1 },
      { seat: 1 as Seat, name: 'Bo', score: 2 },
    ];
    const snapshot = JSON.stringify(input);
    rankStandings(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('gives medals to the top three and numbers after that', () => {
    expect(medalFor(1)).toBe('🥇');
    expect(medalFor(2)).toBe('🥈');
    expect(medalFor(3)).toBe('🥉');
    expect(medalFor(4)).toBe('4');
  });
});
