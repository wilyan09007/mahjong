import { assertThat } from './support';
import {
  EMPTY_SERVER_STATE, MAX_EMOTES, applyServerMessage, useGameStore,
} from '../src/state/store';
import type { ServerState } from '../src/state/store';
import { newHand, viewFor } from '@mahjong/engine';
import type { LobbyMessage } from '../src/net/messages';

/**
 * The reducer is pure, so these drive it directly — no sockets, no mocks. The
 * `view` fixtures are produced by the REAL engine, so a change to the engine's
 * view shape surfaces here rather than on a phone.
 */

const state = newHand({ seed: 501, dealer: 0, dealerStreak: 0, roundWind: 'E' });
const view0 = viewFor(state, 0);
const view1 = viewFor(state, 1);

const lobby: LobbyMessage = {
  code: 'ABC234',
  hostPlayerId: 'p1',
  config: {
    totalRounds: 1, base: 3, perTai: 1,
    turnSeconds: 30, claimSeconds: 7, botDelayMs: 700, interHandMs: 5000,
  },
  seats: [
    { seat: 0, kind: 'human', name: 'Ann', connected: true },
    { seat: 1, kind: 'bot', name: 'Bot 2', connected: true },
    { seat: 2, kind: 'empty', name: null, connected: false },
    { seat: 3, kind: 'empty', name: null, connected: false },
  ],
};

function reduce(messages: [string, unknown][], from: ServerState = EMPTY_SERVER_STATE): ServerState {
  return messages.reduce((s, [type, payload]) => applyServerMessage(s, type, payload), from);
}

describe('applyServerMessage', () => {
  it('stores the lobby and clears any stale error', () => {
    const after = reduce([['error', { message: 'nope' }], ['lobby', lobby]]);
    expect(after.lobby).toEqual(lobby);
    expect(after.errorMessage).toBeNull();
  });

  it('stores the view and clears pendingAction', () => {
    const pending: ServerState = { ...EMPTY_SERVER_STATE, pendingAction: true };
    const after = applyServerMessage(pending, 'view', view0);
    expect(after.view).toEqual(view0);
    expect(after.pendingAction).toBe(false);
  });

  it('replaces the view wholesale rather than merging', () => {
    const after = reduce([['view', view0], ['view', view1]]);
    expect(after.view?.seat).toBe(1);
    expect(after.view).toEqual(view1);
  });

  it('an error does NOT clobber the view — the position is still valid', () => {
    const after = reduce([['view', view0], ['error', { message: 'not your turn' }]]);
    expect(after.errorMessage).toBe('not your turn');
    assertThat(after.view !== null, 'the view was thrown away on an error');
    expect(after.view).toEqual(view0);
    // and inputs are freed so the player can try something else
    expect(after.pendingAction).toBe(false);
  });

  it('an error clears pendingAction, so a rejected action does not lock the UI', () => {
    const pending: ServerState = { ...EMPTY_SERVER_STATE, pendingAction: true };
    expect(applyServerMessage(pending, 'error', { message: 'x' }).pendingAction).toBe(false);
  });

  it('tracks per-seat connection status independently', () => {
    const after = reduce([
      ['seat-status', { seat: 1, connected: false }],
      ['seat-status', { seat: 3, connected: false }],
      ['seat-status', { seat: 1, connected: true }],
    ]);
    expect(after.seatStatus).toEqual({ 1: true, 3: false });
  });

  it('keeps the last hand result and the standings', () => {
    const handResult = {
      result: { type: 'draw-exhausted' as const },
      scores: [0, 0, 0, 0] as [number, number, number, number],
    };
    const standings = [{ seat: 0 as const, name: 'Ann', score: 10 }];
    const after = reduce([['hand-result', handResult], ['session-end', { standings }]]);
    expect(after.lastHandResult).toEqual(handResult);
    expect(after.standings).toEqual(standings);
  });

  it('caps emote bubbles at the most recent few', () => {
    const many: [string, unknown][] = Array.from({ length: 12 }, (_, i) => [
      'emote', { seat: (i % 4) as 0 | 1 | 2 | 3, emote: String(i) },
    ]);
    const after = reduce(many);
    expect(after.emotes).toHaveLength(MAX_EMOTES);
    // The survivors are the newest ones, in order.
    expect(after.emotes.map((e) => e.emote)).toEqual(['7', '8', '9', '10', '11']);
    // Each bubble carries a distinct id so React can key them.
    assertThat(
      new Set(after.emotes.map((e) => e.id)).size === after.emotes.length,
      'emote ids collided, so bubbles would share a React key',
    );
  });

  it('ignores message types it does not know, without corrupting state', () => {
    const before = reduce([['view', view0], ['lobby', lobby]]);
    const after = applyServerMessage(before, 'something-new', { anything: true });
    expect(after).toBe(before);
  });

  it('never mutates the state it was given', () => {
    const before = reduce([['view', view0]]);
    const snapshot = JSON.stringify(before);
    applyServerMessage(before, 'lobby', lobby);
    applyServerMessage(before, 'emote', { seat: 0, emote: '👍' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('routes messages through the reducer', () => {
    useGameStore.getState().onMessage('lobby', lobby);
    expect(useGameStore.getState().lobby).toEqual(lobby);
  });

  it('marks an action pending and clears it on the next view', () => {
    useGameStore.getState().markActionPending();
    expect(useGameStore.getState().pendingAction).toBe(true);
    useGameStore.getState().onMessage('view', view0);
    expect(useGameStore.getState().pendingAction).toBe(false);
  });

  it('keeps identity across a reset, since it is device-level, not room-level', () => {
    useGameStore.getState().setIdentity({ playerId: 'p1', name: 'Ann' });
    useGameStore.getState().onMessage('lobby', lobby);
    useGameStore.getState().reset();
    expect(useGameStore.getState().lobby).toBeNull();
    expect(useGameStore.getState().identity).toEqual({ playerId: 'p1', name: 'Ann' });
  });

  it('dismisses an error without touching the view', () => {
    useGameStore.getState().onMessage('view', view0);
    useGameStore.getState().onMessage('error', { message: 'bad' });
    useGameStore.getState().dismissError();
    expect(useGameStore.getState().errorMessage).toBeNull();
    expect(useGameStore.getState().view).toEqual(view0);
  });
});
