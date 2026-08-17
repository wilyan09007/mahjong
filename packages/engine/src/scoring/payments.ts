/**
 * Tai → per-seat net points.
 *
 * Dealer involvement deliberately does NOT live in the tai table: it is a
 * property of a *payment*, not of the hand. 連N拉N — the dealer's standing
 * bonus grows by two tai per consecutive deal — is `1 + 2 * dealerStreak`, and
 * it applies to a payment whenever the dealer is on either end of it (paying
 * or being paid). Reference: https://www.minwt.com/life/7062.html
 *
 * Self-draw: all three losers pay. Discard win: the discarder pays alone.
 * The result always sums to zero — points move between seats, never in or out.
 */

import type { Seat } from '../tiles.js';

export function computePayments(args: {
  tai: number;
  base: number;
  perTai: number;
  winner: Seat;
  dealer: Seat;
  dealerStreak: number;
  by: 'self-draw' | 'discard';
  discarder: Seat | null;
}): [number, number, number, number] {
  if (args.by === 'discard' && args.discarder === null) {
    throw new Error('a discard win must name the discarder');
  }
  if (args.by === 'discard' && args.discarder === args.winner) {
    throw new Error(`seat ${args.winner} cannot win on their own discard`);
  }

  const net: [number, number, number, number] = [0, 0, 0, 0];
  const dealerExtra = 1 + 2 * args.dealerStreak;
  const payerSeats: Seat[] =
    args.by === 'self-draw'
      ? ([0, 1, 2, 3].filter((s) => s !== args.winner) as Seat[])
      : [args.discarder!];

  for (const payer of payerSeats) {
    const involved = payer === args.dealer || args.winner === args.dealer;
    const tai = args.tai + (involved ? dealerExtra : 0);
    const amount = args.base + tai * args.perTai;
    net[payer] -= amount;
    net[args.winner] += amount;
  }
  return net;
}
