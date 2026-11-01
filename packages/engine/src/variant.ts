/**
 * The pluggability seam between rulesets.
 *
 * `game.ts` never calls a scoring module directly — it resolves a `Variant`
 * from this registry by id. The id, not the object, is what lives on
 * `GameState`, which keeps the state plain JSON: `structuredClone`-able inside
 * the engine, and serialisable straight down a socket by the Plan 2 server.
 * A function reference on the state would break both.
 *
 * Everything a ruleset decides about a win lives here: which shapes count,
 * whether a hand scores enough to be declared at all, what it scores, and who
 * pays. The table mechanics (deal, draw, claim, kong) are shared.
 */

import type { Meld } from './melds.js';
import type { HandRules } from './game.js';
import type { Seat, TileKind } from './tiles.js';
import { isSevenPairs, isThirteenOrphans, isWinningHand } from './win.js';
import { scoreTaiwaneseHand, type ScoreContext, type TaiItem } from './scoring/taiwanese.js';
import { computePayments } from './scoring/payments.js';
import {
  DEFAULT_CANTONESE_RULES, cantonesePoints, computeCantonesePayments, scoreCantoneseHand,
  type CantoneseRules,
} from './scoring/cantonese.js';

export type VariantId = 'taiwanese' | 'cantonese';

export interface PaymentArgs {
  /** The hand's score in the variant's unit (台 or 番). */
  score: number;
  winner: Seat;
  dealer: Seat;
  dealerStreak: number;
  by: 'self-draw' | 'discard';
  discarder: Seat | null;
}

export interface Variant {
  id: VariantId;
  /** Concealed tiles held between turns. Taiwanese 16, Cantonese 13. */
  handSize: number;
  /** The score unit, for display: 台 or 番. */
  unit: string;
  /** Is this hand (winning tile included) a complete winning shape? */
  isWinningShape(concealed: TileKind[], melds: Meld[], rules: HandRules): boolean;
  /**
   * Given a winning shape, may it be declared? Taiwanese: always. Hong Kong:
   * only at or above the house minimum 番 — scored, so it is only asked once
   * the shape is known to be complete.
   */
  canDeclare(ctx: ScoreContext, rules: HandRules): boolean;
  score(ctx: ScoreContext, rules: HandRules): { tai: number; breakdown: TaiItem[] };
  payments(args: PaymentArgs, rules: HandRules): [number, number, number, number];
}

export const TAIWANESE: Variant = {
  id: 'taiwanese',
  handSize: 16,
  unit: '台',
  isWinningShape: (concealed) => isWinningHand(concealed),
  canDeclare: () => true,
  score: (ctx) => scoreTaiwaneseHand(ctx),
  payments: (a, rules) => computePayments({
    tai: a.score, base: rules.base, perTai: rules.perTai, winner: a.winner,
    dealer: a.dealer, dealerStreak: a.dealerStreak, by: a.by, discarder: a.discarder,
  }),
};

export function cantoneseRulesOf(rules: HandRules): CantoneseRules {
  return rules.cantonese ?? DEFAULT_CANTONESE_RULES;
}

export const CANTONESE: Variant = {
  id: 'cantonese',
  handSize: 13,
  unit: '番',
  isWinningShape: (concealed, melds, rules) => isWinningHand(concealed) || (
    melds.length === 0 && (
      isThirteenOrphans(concealed) || (cantoneseRulesOf(rules).sevenPairs && isSevenPairs(concealed))
    )
  ),
  canDeclare: (ctx, rules) => {
    const cr = cantoneseRulesOf(rules);
    return scoreCantoneseHand(ctx, cr).tai >= cr.minFaan;
  },
  score: (ctx, rules) => scoreCantoneseHand(ctx, cantoneseRulesOf(rules)),
  payments: (a, rules) => computeCantonesePayments({
    points: cantonesePoints(a.score, cantoneseRulesOf(rules).payment),
    winner: a.winner, by: a.by, discarder: a.discarder,
  }),
};

export const VARIANTS: Readonly<Record<VariantId, Variant>> = {
  taiwanese: TAIWANESE,
  cantonese: CANTONESE,
};

export function resolveVariant(id: VariantId): Variant {
  const variant = VARIANTS[id];
  if (!variant) {
    throw new Error(
      `variant '${id}' is not implemented (available: ${Object.keys(VARIANTS).join(', ')})`,
    );
  }
  return variant;
}
