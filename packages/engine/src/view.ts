/**
 * The security boundary.
 *
 * `GameState` holds every hidden thing — the ordered wall, the seed that
 * regenerates it, and all four hands. `viewFor` is the ONLY function permitted
 * to turn that into something a client may receive. The server sends
 * `PlayerView`s and nothing else; if a field is not on this type, it does not
 * go on the wire.
 *
 * Two deliberate properties:
 *
 * 1. `OpponentView` has no `hand` field at all. Not an optional one, not an
 *    empty array — absent. There is no code path that could populate it, so a
 *    careless spread on the server cannot leak tiles that were never copied.
 * 2. Everything returned is a COPY. A view crosses into a server, a bot and an
 *    app; if any of them mutated a shared array it would silently corrupt the
 *    authoritative state. Copying a few dozen strings per transition is not a
 *    cost worth optimising against that.
 */

import { legalActions } from './game.js';
import type { Action, GameState, HandResult, Phase } from './game.js';
import type { Meld } from './melds.js';
import type { FlowerKind, Seat, TileKind, Wind } from './tiles.js';

/** What one player may know about another. Note the absence of `hand`. */
export interface OpponentView {
  seat: Seat;
  /** How many concealed tiles they hold — never which ones. */
  handCount: number;
  melds: Meld[];
  flowers: FlowerKind[];
  discards: TileKind[];
}

export interface PlayerView {
  seat: Seat;
  hand: TileKind[];
  melds: Meld[];
  flowers: FlowerKind[];
  discards: TileKind[];
  /** Seats `(me+1)%4`, `(me+2)%4`, `(me+3)%4` — clockwise from me. */
  opponents: [OpponentView, OpponentView, OpponentView];
  /** Tiles left in the live wall. A count, never the tiles. */
  wallCount: number;
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  turn: Seat;
  phase: Phase;
  lastDiscard: { tile: TileKind; by: Seat } | null;
  /** MY legal actions only. Another seat's options are not my business. */
  legalActions: Action[];
  /** Revealed to everyone once the hand is finished. */
  result: HandResult | null;
}

function copyMelds(melds: Meld[]): Meld[] {
  return melds.map((m) => ({ ...m, tiles: [...m.tiles] }));
}

export function viewFor(state: GameState, seat: Seat): PlayerView {
  const me = state.players[seat];

  const opponents = [1, 2, 3].map((i) => {
    const s = ((seat + i) % 4) as Seat;
    const p = state.players[s];
    return {
      seat: s,
      handCount: p.hand.length,
      melds: copyMelds(p.melds),
      flowers: [...p.flowers],
      discards: [...p.discards],
    };
  }) as PlayerView['opponents'];

  return {
    seat,
    hand: [...me.hand],
    melds: copyMelds(me.melds),
    flowers: [...me.flowers],
    discards: [...me.discards],
    opponents,
    wallCount: state.wallBack - state.wallFront + 1,
    dealer: state.dealer,
    dealerStreak: state.dealerStreak,
    roundWind: state.roundWind,
    turn: state.turn,
    phase: state.phase,
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
    legalActions: legalActions(state, seat),
    result: state.result === null ? null : structuredClone(state.result),
  };
}
