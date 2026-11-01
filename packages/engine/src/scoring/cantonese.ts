/**
 * Hong Kong (Cantonese) 13-tile 番 scoring.
 *
 * Values from the approved spec (docs/superpowers/specs/2026-11-01-hong-kong-variant.md),
 * which follows the common published table
 * (https://en.wikipedia.org/wiki/Hong_Kong_mahjong_scoring_rules) with seven
 * pairs raised to 5 番 by house choice.
 *
 * Three layers, in order:
 *   1. LIMIT HANDS. If any applies, the best one is the whole score — no wind,
 *      dragon, flower or winning-condition extras are added to a limit hand.
 *   2. ORDINARY HANDS. Patterns plus extras, with suppression: 小三元/大三元
 *      replace the dragon pungs they contain, 小四喜 the wind pungs. As in the
 *      Taiwanese scorer, every reading of the tiles is scored and the best wins.
 *   3. THE CAP. The total is limited to the house maximum (10 or 13).
 *
 * `tai` in the returned object is the variant's score unit — here, 番.
 */

import { decomposeWinAll, isSevenPairs, isThirteenOrphans } from '../win.js';
import type { Meld } from '../melds.js';
import {
  DRAGONS, WINDS, isHonor, isSuitTile, rankOf, seatWind, suitOf,
  type FlowerKind, type Seat, type TileKind, type Wind, type WindKind,
} from '../tiles.js';
import type { ScoreContext, TaiItem } from './taiwanese.js';

export interface CantoneseRules {
  /** Least 番 a hand must score to be declared at all. 0 lets a chicken hand win. */
  minFaan: number;
  /** The house limit: 10 (Hong Kong Mahjong Association) or 13 (traditional). */
  maxFaan: 10 | 13;
  /** 半辣 or 全辣 points table. */
  payment: 'half' | 'full';
  /** Whether 七對子 is a winning shape. */
  sevenPairs: boolean;
}

export const DEFAULT_CANTONESE_RULES: CantoneseRules = {
  minFaan: 3, maxFaan: 13, payment: 'half', sevenPairs: true,
};

/** The minimums the lobby offers. 0 is "any winning hand". */
export const CANTONESE_MIN_FAAN_OPTIONS = [0, 1, 3, 5] as const;

const WIND_TO_KIND: Record<Wind, WindKind> = { E: 'we', S: 'ws', W: 'ww', N: 'wn' };
const SEAT_INDEX: Record<Wind, number> = { E: 0, S: 1, W: 2, N: 3 };

const isDragon = (t: TileKind): boolean => (DRAGONS as TileKind[]).includes(t);
const isWind = (t: TileKind): boolean => (WINDS as TileKind[]).includes(t);
const isTerminal = (t: TileKind): boolean => isSuitTile(t) && (rankOf(t) === 1 || rankOf(t) === 9);

interface ScoredSet { tiles: TileKind[]; kind: 'chow' | 'pung'; concealed: boolean }
interface Shape { sets: ScoredSet[]; pair: TileKind }

/**
 * Melds plus one reading of the concealed tiles. A pung completed by another
 * player's discard is not concealed even though its tiles sit in the hand —
 * which is what keeps a four-pung hand won off a discard from claiming 坎坎糊.
 */
function buildShape(ctx: ScoreContext, reading: { sets: TileKind[][]; pair: TileKind }): Shape {
  const fromMelds: ScoredSet[] = ctx.melds.map((m: Meld) => ({
    tiles: m.tiles, kind: m.type === 'chow' ? 'chow' : 'pung', concealed: m.concealed,
  }));
  const fromHand: ScoredSet[] = reading.sets.map((tiles) => ({
    tiles, kind: tiles[0] === tiles[1] ? 'pung' : 'chow', concealed: true,
  }));
  if (ctx.by === 'discard') {
    const i = fromHand.findIndex((s) => s.kind === 'pung' && s.tiles[0] === ctx.winTile);
    if (i !== -1) fromHand[i]!.concealed = false;
  }
  return { sets: [...fromMelds, ...fromHand], pair: reading.pair };
}

function allTiles(ctx: ScoreContext): TileKind[] {
  return [...ctx.concealed, ...ctx.melds.flatMap((m) => m.tiles)];
}

/** One suit with no honours → 'full'; one suit plus honours → 'half'; else none. */
function flush(tiles: TileKind[]): 'full' | 'half' | null {
  const suits = new Set(tiles.filter(isSuitTile).map(suitOf));
  if (suits.size !== 1) return null;
  return tiles.some(isHonor) ? 'half' : 'full';
}

/** 九子連環: concealed, one suit, 1112345678999 plus any tile of that suit. */
function isNineGates(ctx: ScoreContext): boolean {
  if (ctx.melds.length > 0 || ctx.concealed.length !== 14) return false;
  if (flush(ctx.concealed) !== 'full') return false;
  const counts = Array(10).fill(0) as number[];
  for (const t of ctx.concealed) counts[rankOf(t)!]!++;
  const need = [0, 3, 1, 1, 1, 1, 1, 1, 1, 3];
  return need.every((n, r) => r === 0 || counts[r]! >= n);
}

function limitHands(ctx: ScoreContext, shapes: Shape[]): TaiItem[] {
  const out: TaiItem[] = [];
  const tiles = allTiles(ctx);
  if (ctx.melds.length === 0 && isThirteenOrphans(ctx.concealed)) out.push({ name: '十三么', tai: 13 });
  if (ctx.isHeavenly) out.push({ name: '天糊', tai: 13 });
  if (ctx.isEarthly) out.push({ name: '地糊', tai: 13 });
  if (ctx.melds.filter((m) => m.type === 'kong').length === 4) out.push({ name: '十八羅漢', tai: 13 });
  if (shapes.some((s) => s.sets.filter((x) => x.kind === 'pung' && isWind(x.tiles[0]!)).length === 4)) {
    out.push({ name: '大四喜', tai: 13 });
  }
  if (tiles.every(isHonor)) out.push({ name: '字一色', tai: 10 });
  if (tiles.every(isTerminal)) out.push({ name: '清么九', tai: 10 });
  if (isNineGates(ctx)) out.push({ name: '九子連環', tai: 10 });
  if (shapes.some((s) => s.sets.length === 4 && s.sets.every((x) => x.kind === 'pung' && x.concealed))) {
    out.push({ name: '坎坎糊', tai: 10 });
  }
  return out;
}

/** Winning conditions and flowers: shared by ordinary hands and seven pairs. */
function extras(ctx: ScoreContext, concealedByDefinition: boolean): TaiItem[] {
  const out: TaiItem[] = [];
  const selfDraw = ctx.by === 'self-draw';
  if (selfDraw) out.push({ name: '自摸', tai: 1 });
  const fullyConcealed = ctx.madeNoClaims && ctx.melds.every((m) => m.concealed);
  if (fullyConcealed && !concealedByDefinition) out.push({ name: '門前清', tai: 1 });
  if (selfDraw && ctx.wasReplacementDraw) {
    out.push((ctx.kongChain ?? 1) >= 2 ? { name: '槓上槓', tai: 8 } : { name: '槓上開花', tai: 1 });
  }
  if (ctx.wasKongRob) out.push({ name: '搶槓', tai: 1 });
  if (ctx.wasLastTile) out.push({ name: '海底撈月', tai: 1 });

  // Flowers: f1–f4 are the four flowers and f5–f8 the four seasons, each
  // numbered East, South, West, North — so a seat's own are fN and fN+4.
  if (ctx.flowers.length === 0) {
    out.push({ name: '無花', tai: 1 });
  } else {
    const seat = SEAT_INDEX[seatWind(ctx.winner, ctx.dealer)];
    for (const [first, own] of [[1, seat + 1], [5, seat + 5]] as const) {
      const group = [0, 1, 2, 3].map((i) => `f${first + i}` as FlowerKind);
      if (group.every((f) => ctx.flowers.includes(f))) out.push({ name: '一台花', tai: 2 });
      else if (ctx.flowers.includes(`f${own}` as FlowerKind)) out.push({ name: '正花', tai: 1 });
    }
  }
  return out;
}

function ordinary(ctx: ScoreContext, shape: Shape): TaiItem[] {
  const out: TaiItem[] = [];
  const tiles = allTiles(ctx);
  const { sets, pair } = shape;
  const pungs = sets.filter((s) => s.kind === 'pung');

  if (sets.every((s) => s.kind === 'chow')) out.push({ name: '平糊', tai: 1 });
  if (sets.every((s) => s.kind === 'pung')) out.push({ name: '對對糊', tai: 3 });
  const f = flush(tiles);
  if (f === 'full') out.push({ name: '清一色', tai: 7 });
  if (f === 'half') out.push({ name: '混一色', tai: 3 });
  if (tiles.every((t) => isHonor(t) || isTerminal(t))) out.push({ name: '花幺九', tai: 1 });

  const dragonPungs = pungs.filter((s) => isDragon(s.tiles[0]!)).length;
  if (dragonPungs === 3) out.push({ name: '大三元', tai: 8 });
  else if (dragonPungs === 2 && isDragon(pair)) out.push({ name: '小三元', tai: 5 });
  else for (let i = 0; i < dragonPungs; i++) out.push({ name: '番子', tai: 1 });

  const windPungs = pungs.filter((s) => isWind(s.tiles[0]!));
  if (windPungs.length === 3 && isWind(pair)) {
    out.push({ name: '小四喜', tai: 6 });
  } else {
    const seatKind = WIND_TO_KIND[seatWind(ctx.winner, ctx.dealer)];
    const roundKind = WIND_TO_KIND[ctx.roundWind];
    if (windPungs.some((s) => s.tiles[0] === seatKind)) out.push({ name: '門風', tai: 1 });
    if (windPungs.some((s) => s.tiles[0] === roundKind)) out.push({ name: '圈風', tai: 1 });
  }

  return [...out, ...extras(ctx, false)];
}

function sevenPairs(ctx: ScoreContext): TaiItem[] {
  const out: TaiItem[] = [{ name: '七對子', tai: 5 }];
  const f = flush(ctx.concealed);
  if (f === 'full') out.push({ name: '清一色', tai: 7 });
  if (f === 'half') out.push({ name: '混一色', tai: 3 });
  return [...out, ...extras(ctx, true)];
}

const total = (items: TaiItem[]): number => items.reduce((n, i) => n + i.tai, 0);

export function scoreCantoneseHand(
  ctx: ScoreContext,
  rules: CantoneseRules = DEFAULT_CANTONESE_RULES,
): { tai: number; breakdown: TaiItem[] } {
  const shapes = decomposeWinAll(ctx.concealed).map((r) => buildShape(ctx, r));

  const limits = limitHands(ctx, shapes);
  if (limits.length > 0) {
    const best = limits.reduce((a, b) => (b.tai > a.tai ? b : a));
    const tai = Math.min(best.tai, rules.maxFaan);
    return { tai, breakdown: [{ name: best.name, tai }] };
  }

  const candidates = shapes.map((s) => ordinary(ctx, s));
  if (rules.sevenPairs && ctx.melds.length === 0 && isSevenPairs(ctx.concealed)) {
    candidates.push(sevenPairs(ctx));
  }
  if (candidates.length === 0) {
    throw new Error(`not a winning hand: ${ctx.concealed.join(' ')}`);
  }
  const best = candidates.reduce((a, b) => (total(b) > total(a) ? b : a));
  const sum = total(best);
  if (sum === 0) return { tai: 0, breakdown: [{ name: '雞糊', tai: 0 }] };
  return { tai: Math.min(sum, rules.maxFaan), breakdown: best };
}

/**
 * Points for a hand of `faan`. Half spicy (半辣) matches full spicy (全辣) up to
 * 4 番, then doubles every two 番, the odd ones half again the one before.
 */
export function cantonesePoints(faan: number, payment: 'half' | 'full'): number {
  if (payment === 'full' || faan <= 4) return 2 ** faan;
  const even = 16 * 2 ** Math.floor((faan - 4) / 2);
  return (faan - 4) % 2 === 0 ? even : even * 1.5;
}

/**
 * Who pays whom. A discard win: the discarder pays the table value. A
 * self-draw: each of the other three pays half of it. No dealer bonus — that
 * is a Taiwanese rule. Always sums to zero.
 */
export function computeCantonesePayments(args: {
  points: number;
  winner: Seat;
  by: 'self-draw' | 'discard';
  discarder: Seat | null;
}): [number, number, number, number] {
  if (args.by === 'discard' && (args.discarder === null || args.discarder === args.winner)) {
    throw new Error(`a discard win needs a discarder other than the winner (seat ${args.winner})`);
  }
  const net: [number, number, number, number] = [0, 0, 0, 0];
  const payers = args.by === 'self-draw'
    ? ([0, 1, 2, 3] as Seat[]).filter((s) => s !== args.winner)
    : [args.discarder!];
  const each = args.by === 'self-draw' ? args.points / 2 : args.points;
  for (const p of payers) {
    net[p] -= each;
    net[args.winner] += each;
  }
  return net;
}
