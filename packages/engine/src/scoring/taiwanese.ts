/**
 * Taiwanese 16-tile tai (台) scoring.
 *
 * Values verified against a published 台灣十六張麻將台數表:
 *   https://www.minwt.com/life/7062.html
 * which gives 自摸 1 · 門清 1 · 門清自摸 3 · 花牌 1 each · 三元牌 1 each ·
 * 圈風 1 · 門風 1 · 獨聽 1 · 槓上開花 1 · 搶槓 1 · 海底撈月 1 · 平胡 2 ·
 * 碰碰胡 4 · 混一色 4 · 小三元 4 · 清一色 8 · 大三元 8 · 小四喜 8 ·
 * 大四喜 16 · 字一色 16 · 四暗刻 5 · 五暗刻 8, and 連N拉N = 2n+1 for the
 * dealer bonus (which lives in payments.ts, not here — see that file).
 *
 * Two things make this more than a list of predicates:
 *
 * 1. SUPPRESSION. The big hands replace the small ones they contain rather
 *    than stacking with them: 大三元/小三元 replace 三元牌, 大四喜/小四喜
 *    replace 場風 and 門風, 五暗刻 replaces 四暗刻.
 *
 * 2. THE BEST READING WINS. The same tiles can often be read more than one
 *    way — 1t1t1t 2t2t2t 3t3t3t is three pungs or three runs — and the
 *    readings score differently. Taiwanese practice scores the winner's best
 *    reading, so every reading from `decomposeWinAll` is evaluated and the
 *    highest total is returned.
 */

import { decomposeWinAll, winningTiles } from '../win.js';
import type { Meld } from '../melds.js';
import {
  DRAGONS, WINDS, isHonor, isSuitTile, seatWind, suitOf,
  type FlowerKind, type Seat, type TileKind, type Wind, type WindKind,
} from '../tiles.js';

export interface TaiItem {
  name: string;
  tai: number;
}

export interface ScoreContext {
  /** The winner's concealed tiles INCLUDING the winning tile. */
  concealed: TileKind[];
  melds: Meld[];
  flowers: FlowerKind[];
  winTile: TileKind;
  by: 'self-draw' | 'discard';
  winner: Seat;
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  /** Never chowed, punged or exposed-konged from another player (門清). */
  madeNoClaims: boolean;
  /** 槓上開花 — the winning tile came from the dead wall. */
  wasReplacementDraw: boolean;
  /** 搶槓 — the winning tile was robbed off an added kong. */
  wasKongRob: boolean;
  /** 海底撈月 — the winning tile was the last drawable one. */
  wasLastTile: boolean;
}

type SetKind = 'chow' | 'pung';

/** One set as scoring sees it. A kong scores as a pung; only its size differs. */
interface ScoredSet {
  tiles: TileKind[];
  kind: SetKind;
  /** Formed without taking a tile from another player. Drives 四暗刻/五暗刻. */
  concealed: boolean;
}

interface Shape {
  sets: ScoredSet[];
  pair: TileKind;
}

const WIND_TO_KIND: Record<Wind, WindKind> = { E: 'we', S: 'ws', W: 'ww', N: 'wn' };

function isDragonKind(t: TileKind): boolean {
  return (DRAGONS as TileKind[]).includes(t);
}

function isWindKind(t: TileKind): boolean {
  return (WINDS as TileKind[]).includes(t);
}

/**
 * Melds plus one reading of the concealed tiles, as a single list of sets.
 *
 * The `concealed` flag is where a subtlety lives: a pung completed by another
 * player's discard is not a concealed pung, even though its three tiles sit in
 * your hand. Winning on a discard therefore demotes exactly one set — the pung
 * the winning tile completed — which is what stops a 4-pung hand won off a
 * discard from claiming 四暗刻 it did not earn.
 */
function buildShape(ctx: ScoreContext, reading: { sets: TileKind[][]; pair: TileKind }): Shape {
  const fromMelds: ScoredSet[] = ctx.melds.map((m) => ({
    tiles: m.tiles,
    kind: m.type === 'chow' ? 'chow' : 'pung',
    concealed: m.concealed,
  }));

  const fromHand: ScoredSet[] = reading.sets.map((tiles) => ({
    tiles,
    // A run's three tiles are all different; a pung's are all the same.
    kind: tiles[0] === tiles[1] ? 'pung' : 'chow',
    concealed: true,
  }));

  if (ctx.by === 'discard') {
    const i = fromHand.findIndex(
      (s) => s.kind === 'pung' && s.tiles[0] === ctx.winTile,
    );
    if (i !== -1) fromHand[i]!.concealed = false;
  }

  return { sets: [...fromMelds, ...fromHand], pair: reading.pair };
}

function evaluate(ctx: ScoreContext, shape: Shape, singleWait: boolean): TaiItem[] {
  const out: TaiItem[] = [];
  const push = (name: string, tai: number): void => {
    if (tai > 0) out.push({ name, tai });
  };

  const selfDraw = ctx.by === 'self-draw';
  const fullyConcealed = ctx.madeNoClaims && ctx.melds.every((m) => m.concealed);

  // --- how the hand was won -------------------------------------------------
  if (selfDraw) push('自摸', 1);
  if (fullyConcealed) push('門清', 1);
  // 門清自摸 is 3 tai total, not 2: the combination earns an extra tai on top
  // of its two halves.
  if (selfDraw && fullyConcealed) push('門清自摸加台', 1);
  push('花牌', ctx.flowers.length);

  // --- honors ---------------------------------------------------------------
  const dragonSets = shape.sets.filter((s) => s.kind === 'pung' && isDragonKind(s.tiles[0]!));
  const pairIsDragon = isDragonKind(shape.pair);
  const bigThreeDragons = dragonSets.length === 3;
  const smallThreeDragons = dragonSets.length === 2 && pairIsDragon;
  if (!bigThreeDragons && !smallThreeDragons) push('三元牌', dragonSets.length);

  const windSets = shape.sets.filter((s) => s.kind === 'pung' && isWindKind(s.tiles[0]!));
  const pairIsWind = isWindKind(shape.pair);
  const bigFourWinds = windSets.length === 4;
  const smallFourWinds = windSets.length === 3 && pairIsWind;

  const roundKind = WIND_TO_KIND[ctx.roundWind];
  const seatKind = WIND_TO_KIND[seatWind(ctx.winner, ctx.dealer)];
  if (!bigFourWinds && !smallFourWinds) {
    if (windSets.some((s) => s.tiles[0] === roundKind)) push('場風', 1);
    if (windSets.some((s) => s.tiles[0] === seatKind)) push('門風', 1);
  }

  // --- the winning tile -----------------------------------------------------
  if (singleWait) push('獨聽', 1);
  if (ctx.wasReplacementDraw && selfDraw) push('槓上開花', 1);
  if (ctx.wasKongRob) push('搶槓', 1);
  if (ctx.wasLastTile && selfDraw) push('海底撈月', 1);

  // --- hand shape -----------------------------------------------------------
  const allChows = shape.sets.every((s) => s.kind === 'chow');
  const pairIsRelevantWind = shape.pair === roundKind || shape.pair === seatKind;
  if (
    allChows && !pairIsDragon && !pairIsRelevantWind &&
    ctx.flowers.length === 0 && !singleWait && !selfDraw
  ) {
    push('平胡', 2);
  }

  if (shape.sets.every((s) => s.kind === 'pung')) push('碰碰胡', 4);

  const tiles = [...shape.sets.flatMap((s) => s.tiles), shape.pair, shape.pair];
  const suits = new Set(tiles.filter(isSuitTile).map((t) => suitOf(t)!));
  const hasHonors = tiles.some(isHonor);
  if (suits.size === 1 && hasHonors) push('混一色', 4);
  if (suits.size === 1 && !hasHonors) push('清一色', 8);
  if (suits.size === 0) push('字一色', 16);

  if (smallThreeDragons) push('小三元', 4);
  if (bigThreeDragons) push('大三元', 8);
  if (smallFourWinds) push('小四喜', 8);
  if (bigFourWinds) push('大四喜', 16);

  const concealedPungs = shape.sets.filter((s) => s.kind === 'pung' && s.concealed).length;
  if (concealedPungs >= 5) push('五暗刻', 8);
  else if (concealedPungs >= 4) push('四暗刻', 5);

  return out;
}

export function scoreTaiwaneseHand(ctx: ScoreContext): { tai: number; breakdown: TaiItem[] } {
  if (!ctx.concealed.includes(ctx.winTile)) {
    throw new Error(
      `winTile ${ctx.winTile} is not among the winner's concealed tiles ` +
        `(${ctx.concealed.join(' ')}) — the caller assembled ScoreContext wrongly`,
    );
  }

  const readings = decomposeWinAll(ctx.concealed);
  if (readings.length === 0) {
    throw new Error(
      `cannot score a non-winning hand: concealed=${ctx.concealed.join(' ')} ` +
        `melds=${ctx.melds.map((m) => m.tiles.join('')).join(' ') || 'none'}`,
    );
  }

  // 獨聽 depends only on the tiles, not on how they are read, so compute it once.
  const withoutWinTile = [...ctx.concealed];
  withoutWinTile.splice(withoutWinTile.indexOf(ctx.winTile), 1);
  const singleWait = winningTiles(withoutWinTile).length === 1;

  let best: { tai: number; breakdown: TaiItem[] } | null = null;
  for (const reading of readings) {
    const breakdown = evaluate(ctx, buildShape(ctx, reading), singleWait);
    const tai = breakdown.reduce((n, item) => n + item.tai, 0);
    if (best === null || tai > best.tai) best = { tai, breakdown };
  }
  return best!;
}
