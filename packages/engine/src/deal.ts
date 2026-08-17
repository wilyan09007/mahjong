/**
 * The opening deal.
 *
 * Taiwanese order: four passes of four tiles each in seat order starting from
 * the dealer, then one extra tile to the dealer — 16 each, 17 for the dealer,
 * 65 tiles off the front of the wall.
 *
 * Then flowers. Any flower in a hand is exposed and replaced from the BACK of
 * the wall (the dead wall), repeatedly, because a replacement can itself be a
 * flower. The loop runs in seat order from the dealer and repeats until a full
 * pass finds nothing — that ordering is what makes the deal reproducible from
 * the seed alone.
 */

import { isFlower, sortTiles, type FlowerKind, type Seat, type TileKind } from './tiles.js';

export interface DealResult {
  hands: TileKind[][];
  flowers: FlowerKind[][];
  /**
   * The dealer's 17th tile — their opening "draw". Captured before the hands
   * are sorted, because sorting destroys the only record of which tile arrived
   * last, and scoring a 天胡 needs it by identity.
   */
  dealerLastTile: TileKind;
  /** Next index to draw from the front (normal draws). */
  wallFront: number;
  /** Next index to draw from the back (flower and kong replacements). */
  wallBack: number;
}

export function dealHands(tiles: TileKind[], dealer: Seat): DealResult {
  let front = 0;
  let back = tiles.length - 1;
  const hands: TileKind[][] = [[], [], [], []];

  // 4 passes of 4 tiles in seat order from the dealer, then 1 extra for the dealer.
  for (let pass = 0; pass < 4; pass++) {
    for (let s = 0; s < 4; s++) {
      const seat = ((dealer + s) % 4) as Seat;
      for (let i = 0; i < 4; i++) hands[seat]!.push(tiles[front++]!);
    }
  }
  hands[dealer]!.push(tiles[front++]!);

  const flowers: FlowerKind[][] = [[], [], [], []];
  let replaced = true;
  while (replaced) {
    replaced = false;
    for (let s = 0; s < 4; s++) {
      const seat = ((dealer + s) % 4) as Seat;
      const hand = hands[seat]!;
      for (let i = 0; i < hand.length; i++) {
        const t = hand[i]!;
        if (isFlower(t)) {
          flowers[seat]!.push(t);
          // Replacing in place keeps the hand length fixed; the replacement is
          // re-examined by the outer `while` in case it is a flower too.
          hand[i] = tiles[back--]!;
          replaced = true;
        }
      }
    }
  }

  // Flower replacement writes in place, so slot 16 is still the dealer's 17th
  // tile — but only until the hands are sorted, so read it now.
  const dealerLastTile = hands[dealer]![16]!;

  return {
    hands: hands.map((h) => sortTiles(h)),
    flowers,
    dealerLastTile,
    wallFront: front,
    wallBack: back,
  };
}
