/**
 * The bot policy: shanten minimisation with simple discard taste.
 *
 * Target strength is "competent intermediate", per the spec — not a research
 * AI. It plays only from a `PlayerView`, exactly what a human client receives,
 * so it cannot see the wall or anyone's hand. That is not a courtesy: it is the
 * reason the bot can stand in for a disconnected player without cheating.
 *
 * Every comparison is made between hands of the SAME shape. A 16-tile hand and
 * a 17-tile hand are not comparable — the second is one draw further along —
 * so a claim that obliges a follow-up discard is scored *after* that discard.
 * Getting this wrong makes a bot that claims everything, or nothing.
 */

import { isHonor, mulberry32, rankOf } from '@mahjong/engine';
import type { Action, PlayerView, TileKind } from '@mahjong/engine';
import { shanten16 } from './shanten.js';

type DiscardAction = Extract<Action, { type: 'discard' }>;
type ClaimAction = Extract<Action, { type: 'claim' }>;

/** Remove one occurrence of each tile, loudly if it is not there. */
function without(hand: TileKind[], tiles: TileKind[]): TileKind[] {
  const rest = [...hand];
  for (const t of tiles) {
    const i = rest.indexOf(t);
    if (i === -1) {
      throw new Error(`bot: cannot remove ${t} from ${hand.join(' ')} — view is inconsistent`);
    }
    rest.splice(i, 1);
  }
  return rest;
}

/**
 * Throw-away order for tiles that are equally useless by shanten: honors
 * first (they only ever form pungs, and three are already gone if two are
 * out), then terminals (they sit at the end of fewer runs), then middles.
 */
function discardPreference(tile: TileKind): number {
  if (isHonor(tile)) return 0;
  const rank = rankOf(tile);
  return rank === 1 || rank === 9 ? 1 : 2;
}

/** Best shanten reachable from a 3n+2 hand after it discards once. */
function bestAfterDiscard(hand: TileKind[], meldCount: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const tile of new Set(hand)) {
    best = Math.min(best, shanten16(without(hand, [tile]), meldCount));
  }
  return best;
}

function pickDiscard(candidates: DiscardAction[], rng: () => number): DiscardAction {
  const ranked = candidates.map((a) => ({ a, rank: discardPreference(a.tile) }));
  const bestRank = Math.min(...ranked.map((r) => r.rank));
  const finalists = ranked.filter((r) => r.rank === bestRank).map((r) => r.a);
  return finalists[Math.floor(rng() * finalists.length)] ?? finalists[0]!;
}

/**
 * On our own turn: weigh every discard, and take a kong only when it does not
 * set us back. A kong is tempting (extra tai, a free replacement draw) but it
 * locks four tiles into a fixed shape, so requiring "no worse than the best
 * discard" is the whole guard.
 */
function chooseOnTurn(view: PlayerView, acts: Action[], rng: () => number): Action {
  const meldCount = view.melds.length;
  const discards = acts.filter((a): a is DiscardAction => a.type === 'discard');
  if (discards.length === 0) return acts[0]!;

  const scored = discards.map((a) => ({
    a,
    shanten: shanten16(without(view.hand, [a.tile]), meldCount),
  }));
  const best = Math.min(...scored.map((s) => s.shanten));

  for (const kong of acts) {
    if (kong.type === 'concealed-kong') {
      // Four tiles leave the hand and become a meld; the replacement draw puts
      // the count back, so the result is another 16-value shape.
      const after = shanten16(
        without(view.hand, [kong.tile, kong.tile, kong.tile, kong.tile]),
        meldCount + 1,
      );
      if (after <= best) return kong;
    } else if (kong.type === 'added-kong') {
      // One tile moves onto an existing pung; the meld count does not change.
      const after = shanten16(without(view.hand, [kong.tile]), meldCount);
      if (after <= best) return kong;
    }
  }

  return pickDiscard(scored.filter((s) => s.shanten === best).map((s) => s.a), rng);
}

/**
 * On someone else's discard: claim only when it STRICTLY improves the hand.
 *
 * Claiming is not free — it exposes a meld (losing 門清) and hands the turn
 * order around — so "no worse" is not good enough here, unlike a kong on our
 * own turn where we were going to discard anyway.
 */
function chooseClaim(view: PlayerView, acts: Action[], rng: () => number): Action {
  const meldCount = view.melds.length;
  const pass = acts.find((a) => a.type === 'pass');
  const tile = view.lastDiscard?.tile;
  if (tile === undefined) return pass ?? acts[0]!;

  const before = shanten16(view.hand, meldCount);
  let best: { action: ClaimAction; shanten: number } | null = null;

  for (const a of acts) {
    if (a.type !== 'claim') continue;
    let after: number;
    if (a.claim === 'kong') {
      // Three leave the hand, a replacement arrives: still a 16-value shape,
      // directly comparable to `before`.
      after = shanten16(without(view.hand, [tile, tile, tile]), meldCount + 1);
    } else if (a.claim === 'pung') {
      // Two leave the hand and we must then discard — score after that discard.
      after = bestAfterDiscard(without(view.hand, [tile, tile]), meldCount + 1);
    } else if (a.claim === 'chow') {
      if (!a.chowTiles) continue;
      after = bestAfterDiscard(without(view.hand, a.chowTiles), meldCount + 1);
    } else {
      continue; // 'win' is handled before we ever get here
    }
    if (after < before && (best === null || after < best.shanten)) {
      best = { action: a, shanten: after };
    }
  }

  if (best) return best.action;
  return pass ?? acts[Math.floor(rng() * acts.length)]!;
}

export function chooseBotAction(view: PlayerView, rng: () => number = mulberry32(1)): Action {
  const acts = view.legalActions;
  if (acts.length === 0) {
    throw new Error(
      `bot has no legal actions (seat ${view.seat}, phase ${view.phase}) — ` +
        `the caller should not have asked`,
    );
  }

  // Winning is never a judgement call.
  const win = acts.find(
    (a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win'),
  );
  if (win) return win;

  return view.phase === 'awaiting-claims'
    ? chooseClaim(view, acts, rng)
    : chooseOnTurn(view, acts, rng);
}
