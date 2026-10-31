/**
 * What just happened at the table, worked out from two views.
 *
 * The server sends positions, not events: each message is the whole table as
 * it now stands. Animation needs events — "seat 2 just threw 5t", "I just drew
 * a tile" — so this compares the previous view with the new one and names the
 * differences. Pure, so every event the engine can cause is testable from real
 * play without a renderer.
 */

import type { MeldType, PlayerView, Seat, TileKind } from '@mahjong/engine';

export type TableEvent =
  | { type: 'deal' }
  /** Tiles that arrived in my hand, as indices into the new (sorted) hand. */
  | { type: 'draw'; indices: number[] }
  | { type: 'discard'; seat: Seat; tile: TileKind }
  | { type: 'claim'; seat: Seat; meld: MeldType }
  | { type: 'flower'; seat: Seat }
  | { type: 'win'; seat: Seat; by: 'self-draw' | 'discard' }
  | { type: 'exhausted' };

/**
 * Indices in `next` of tiles that were not in `prev`, counting copies — a
 * second 5t is new even if one was already held. Both hands are sorted, so a
 * drawn tile can land anywhere; this finds where it went.
 */
export function addedIndices(prev: TileKind[], next: TileKind[]): number[] {
  const held = new Map<TileKind, number>();
  for (const t of prev) held.set(t, (held.get(t) ?? 0) + 1);
  const out: number[] = [];
  next.forEach((t, i) => {
    const left = held.get(t) ?? 0;
    if (left > 0) held.set(t, left - 1);
    else out.push(i);
  });
  return out;
}

interface SeatPicture {
  seat: Seat;
  discards: TileKind[];
  melds: PlayerView['melds'];
  flowers: TileKind[];
}

function seatsOf(view: PlayerView): SeatPicture[] {
  return [
    { seat: view.seat, discards: view.discards, melds: view.melds, flowers: view.flowers },
    ...view.opponents,
  ];
}

/** A hand has just opened: nothing has been thrown yet and no result stands. */
function isFreshHand(view: PlayerView): boolean {
  return view.result === null && seatsOf(view).every((s) => s.discards.length === 0 && s.melds.length === 0);
}

export function tableEvents(prev: PlayerView | null, next: PlayerView): TableEvent[] {
  // A new hand: first sight of a fresh table, or the wall refilled after a
  // finished one. A reconnect mid-hand is NOT a deal — its tiles were dealt
  // long ago, and replaying that would be a lie about the game.
  const newHand = prev === null || prev.result !== null || next.wallCount > prev.wallCount;
  if (newHand) return isFreshHand(next) && next.hand.length > 0 ? [{ type: 'deal' }] : [];

  const events: TableEvent[] = [];

  const drawn = addedIndices(prev.hand, next.hand);
  if (drawn.length > 0) events.push({ type: 'draw', indices: drawn });

  const before = new Map(seatsOf(prev).map((s) => [s.seat, s]));
  for (const now of seatsOf(next)) {
    const was = before.get(now.seat);
    if (!was) continue;

    if (now.discards.length > was.discards.length) {
      events.push({ type: 'discard', seat: now.seat, tile: now.discards.at(-1)! });
    }
    // A new meld, or a pung upgraded in place to a kong (an added kong keeps
    // the meld count the same).
    const grew = now.melds.length > was.melds.length;
    const upgraded = !grew && now.melds.some((m, i) => m.type === 'kong' && was.melds[i]?.type === 'pung');
    if (grew || upgraded) {
      events.push({ type: 'claim', seat: now.seat, meld: grew ? now.melds.at(-1)!.type : 'kong' });
    }
    if (now.flowers.length > was.flowers.length) events.push({ type: 'flower', seat: now.seat });
  }

  if (next.result && !prev.result) {
    events.push(next.result.type === 'win'
      ? { type: 'win', seat: next.result.winner, by: next.result.by }
      : { type: 'exhausted' });
  }
  return events;
}
