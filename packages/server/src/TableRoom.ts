import { Room } from '@colyseus/core';

/**
 * A private mahjong table.
 *
 * Deliberately NOT a Colyseus schema room. The authoritative `GameState` is a
 * plain object held here and never synchronised — every client instead receives
 * a `PlayerView` built by the engine's `viewFor`. Colyseus schema sync would
 * broadcast one shared state to everyone, which is precisely the thing that
 * must not happen in a hidden-information game.
 *
 * Grows across Tasks 4-9 of Plan 2. Right now it is the empty shell the
 * matchmaker needs in order to define the room type.
 */
export class TableRoom extends Room {
  override maxClients = 4;
}
