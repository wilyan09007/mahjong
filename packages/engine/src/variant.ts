/**
 * The pluggability seam for Cantonese (v1.1).
 *
 * `game.ts` never calls the Taiwanese module directly — it resolves a `Variant`
 * from this registry by id. The id, not the object, is what lives on
 * `GameState`, which keeps the state plain JSON: `structuredClone`-able inside
 * the engine, and serialisable straight down a socket by the Plan 2 server.
 * A function reference on the state would break both.
 */

import { scoreTaiwaneseHand, type ScoreContext, type TaiItem } from './scoring/taiwanese.js';

export type VariantId = 'taiwanese' | 'cantonese';

export interface Variant {
  id: VariantId;
  /** Concealed tiles held between turns. Taiwanese 16, Cantonese 13. */
  handSize: number;
  score(ctx: ScoreContext): { tai: number; breakdown: TaiItem[] };
}

export const TAIWANESE: Variant = {
  id: 'taiwanese',
  handSize: 16,
  score: scoreTaiwaneseHand,
};

/** Cantonese is deliberately absent until v1.1 rather than stubbed. */
export const VARIANTS: Readonly<Partial<Record<VariantId, Variant>>> = {
  taiwanese: TAIWANESE,
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
