import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANTONESE_RULES, cantonesePoints, computeCantonesePayments, scoreCantoneseHand,
  type CantoneseRules,
} from '../src/scoring/cantonese.js';
import type { ScoreContext } from '../src/scoring/taiwanese.js';
import { isSevenPairs, isThirteenOrphans, isWinningHand } from '../src/win.js';
import type { Meld } from '../src/melds.js';
import type { FlowerKind, TileKind } from '../src/tiles.js';

/**
 * The Hong Kong 番 table, one pattern per test, against the approved spec
 * (docs/superpowers/specs/2026-11-01-hong-kong-variant.md).
 *
 * Fixtures default to the winner in seat 1 with seat 0 dealing in an East
 * round — so the winner's seat wind is SOUTH, own flower f2, own season f6 —
 * holding one non-matching flower (f1), so neither 無花 nor 正花 scores unless
 * a test asks for it. That keeps every total exactly the pattern under test.
 */

const RULES = DEFAULT_CANTONESE_RULES;

function ctx(partial: Partial<ScoreContext> & Pick<ScoreContext, 'concealed'>): ScoreContext {
  return {
    melds: [], flowers: ['f1'], winTile: partial.concealed[partial.concealed.length - 1]!,
    by: 'discard', winner: 1, dealer: 0, dealerStreak: 0, roundWind: 'E',
    madeNoClaims: false, wasReplacementDraw: false, wasKongRob: false, wasLastTile: false,
    ...partial,
  };
}

/** Every fixture must be a real 14-tile winning shape (less 3 per meld). */
function hand(name: string, tiles: TileKind[], melds = 0): TileKind[] {
  if (tiles.length !== 14 - melds * 3) throw new Error(`${name}: ${tiles.length} tiles`);
  if (!isWinningHand(tiles) && !isSevenPairs(tiles) && !isThirteenOrphans(tiles)) {
    throw new Error(`${name} is not a winning shape: ${tiles.join(' ')}`);
  }
  return tiles;
}

const score = (c: ScoreContext, rules: CantoneseRules = RULES) => scoreCantoneseHand(c, rules);
const names = (r: { breakdown: { name: string }[] }) => r.breakdown.map((b) => b.name);

const CHICKEN = hand('雞糊', ['1w', '2w', '3w', '4t', '5t', '6t', '7b', '7b', '7b', '2b', '3b', '4b', '9w', '9w']);
const ALL_CHOWS = hand('平糊', ['1w', '2w', '3w', '4w', '5w', '6w', '2t', '3t', '4t', '6b', '7b', '8b', '9t', '9t']);
const ALL_PUNGS = hand('對對糊', ['1w', '1w', '1w', '5t', '5t', '5t', '7b', '7b', '7b', '9w', '9w', '9w', '2t', '2t']);
const HALF_FLUSH = hand('混一色', ['1t', '2t', '3t', '4t', '5t', '6t', '8t', '8t', '8t', 'wn', 'wn', 'wn', '9t', '9t']);
const FULL_FLUSH = hand('清一色', ['1t', '2t', '3t', '4t', '5t', '6t', '7t', '8t', '9t', '2t', '2t', '2t', '5t', '5t']);
const SEVEN_PAIRS = hand('七對子', ['1w', '1w', '3w', '3w', '5t', '5t', '7t', '7t', '2b', '2b', '9b', '9b', 'wn', 'wn']);
const SMALL_DRAGONS = hand('小三元', ['dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', '1t', '2t', '3t', '4b', '5b', '6b']);
const BIG_DRAGONS = hand('大三元', ['dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', 'dw', '1t', '2t', '3t', '9b', '9b']);
const SMALL_WINDS = hand('小四喜', ['we', 'we', 'we', 'ws', 'ws', 'ws', 'ww', 'ww', 'ww', 'wn', 'wn', '1t', '2t', '3t']);
const MIXED_ORPHANS = hand('花幺九', ['1w', '1w', '1w', '9t', '9t', '9t', '1b', '1b', '1b', 'wn', 'wn', 'wn', '9b', '9b']);
const THIRTEEN = hand('十三么', ['1w', '9w', '1t', '9t', '1b', '9b', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw', 'dw']);
const ALL_HONOURS = hand('字一色', ['we', 'we', 'we', 'ws', 'ws', 'ws', 'dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw']);
const ALL_TERMINALS = hand('清么九', ['1w', '1w', '1w', '9w', '9w', '9w', '1t', '1t', '1t', '9b', '9b', '9b', '1b', '1b']);
const NINE_GATES = hand('九子連環', ['1t', '1t', '1t', '2t', '3t', '4t', '5t', '5t', '6t', '7t', '8t', '9t', '9t', '9t']);
const BIG_WINDS = hand('大四喜', ['we', 'we', 'we', 'ws', 'ws', 'ws', 'ww', 'ww', 'ww', 'wn', 'wn', 'wn', '5t', '5t']);
const PUNG_OR_CHOWS = hand('best reading', ['1t', '1t', '1t', '2t', '2t', '2t', '3t', '3t', '3t', '5b', '5b', '5b', '9w', '9w']);

describe('win shapes', () => {
  it('knows seven distinct pairs, and not six pairs with a four-of-a-kind', () => {
    expect(isSevenPairs(SEVEN_PAIRS)).toBe(true);
    expect(isSevenPairs(['1w', '1w', '1w', '1w', '5t', '5t', '7t', '7t', '2b', '2b', '9b', '9b', 'wn', 'wn'])).toBe(false);
    expect(isSevenPairs(ALL_CHOWS)).toBe(false);
  });
  it('knows thirteen orphans: every terminal and honour once, one of them twice', () => {
    expect(isThirteenOrphans(THIRTEEN)).toBe(true);
    expect(isThirteenOrphans([...THIRTEEN.slice(0, 13), '5t'])).toBe(false);
  });
});

describe('番 patterns', () => {
  it('雞糊: a winning hand with nothing scores 0', () => {
    const r = score(ctx({ concealed: CHICKEN }));
    expect(r.tai).toBe(0);
    expect(names(r)).toEqual(['雞糊']);
  });
  it('平糊 all chows: 1', () => expect(score(ctx({ concealed: ALL_CHOWS })).tai).toBe(1));
  // Won off a discard that completes a pung: that pung is not concealed, so
  // this is 對對糊 and not the 坎坎糊 limit hand.
  it('對對糊 all pungs: 3', () => expect(score(ctx({ concealed: ALL_PUNGS, winTile: '1w' })).tai).toBe(3));
  it('混一色 half flush: 3', () => expect(score(ctx({ concealed: HALF_FLUSH })).tai).toBe(3));
  it('清一色 full flush: 7', () => expect(score(ctx({ concealed: FULL_FLUSH })).tai).toBe(7));
  it('七對子 seven pairs: 5, and never also 門前清', () => {
    const r = score(ctx({ concealed: SEVEN_PAIRS, madeNoClaims: true }));
    expect(r.tai).toBe(5);
    expect(names(r)).not.toContain('門前清');
  });
  it('花幺九 terminals and honours: 1, plus the 對對糊 it always is', () => {
    const r = score(ctx({ concealed: MIXED_ORPHANS, winTile: '1w' }));
    expect(names(r)).toEqual(expect.arrayContaining(['花幺九', '對對糊']));
    expect(r.tai).toBe(4);
  });
  it('小三元: 5, replacing the dragon pungs it contains', () => {
    const r = score(ctx({ concealed: SMALL_DRAGONS }));
    expect(r.tai).toBe(5);
    expect(names(r)).not.toContain('番子');
  });
  it('大三元: 8, replacing the dragon pungs', () => {
    const r = score(ctx({ concealed: BIG_DRAGONS }));
    expect(r.tai).toBe(8);
  });
  it('小四喜: 6, replacing the wind pungs', () => {
    const r = score(ctx({ concealed: SMALL_WINDS }));
    expect(names(r)).not.toContain('門風');
    expect(names(r)).not.toContain('圈風');
    expect(r.breakdown).toContainEqual({ name: '小四喜', tai: 6 });
  });
  it('scores the best reading: three pungs beat three runs', () => {
    expect(score(ctx({ concealed: PUNG_OR_CHOWS, winTile: '5b' })).breakdown).toContainEqual({ name: '對對糊', tai: 3 });
  });
});

describe('extras', () => {
  const windHand = (w: TileKind) => hand(`${w} pung`, ['1w', '2w', '3w', '4t', '5t', '6t', '7b', '8b', '9b', w, w, w, '9w', '9w']);
  it('番子: 1 per dragon pung', () => {
    const r = score(ctx({ concealed: hand('dragon', ['1w', '2w', '3w', '4t', '5t', '6t', '7b', '8b', '9b', 'dr', 'dr', 'dr', '9w', '9w']) }));
    expect(r.breakdown).toContainEqual({ name: '番子', tai: 1 });
  });
  it('門風 seat wind and 圈風 round wind: 1 each, 2 when they are the same wind', () => {
    expect(score(ctx({ concealed: windHand('ws') })).breakdown).toContainEqual({ name: '門風', tai: 1 });
    expect(score(ctx({ concealed: windHand('we') })).breakdown).toContainEqual({ name: '圈風', tai: 1 });
    // The dealer sits East, so f1 would be their own flower: hold f2 instead.
    const dealer = score(ctx({ concealed: windHand('we'), winner: 0, flowers: ['f2'] }));
    expect(dealer.tai).toBe(2);
  });
  it('自摸 self-drawn and 門前清 fully concealed: 1 each', () => {
    const r = score(ctx({ concealed: CHICKEN, by: 'self-draw', madeNoClaims: true }));
    expect(names(r)).toEqual(expect.arrayContaining(['自摸', '門前清']));
    expect(r.tai).toBe(2);
  });
  it('無花 no flowers, 正花 own flower and season, 一台花 a full set', () => {
    expect(score(ctx({ concealed: CHICKEN, flowers: [] })).breakdown).toContainEqual({ name: '無花', tai: 1 });
    const own = score(ctx({ concealed: CHICKEN, flowers: ['f2', 'f6'] as FlowerKind[] }));
    expect(own.breakdown.filter((b) => b.name === '正花')).toHaveLength(2);
    const full = score(ctx({ concealed: CHICKEN, flowers: ['f1', 'f2', 'f3', 'f4'] as FlowerKind[] }));
    expect(full.breakdown).toContainEqual({ name: '一台花', tai: 2 });
    expect(names(full)).not.toContain('正花');
  });
  it('槓上開花, 槓上槓, 搶槓 and 海底撈月', () => {
    const kong = score(ctx({ concealed: CHICKEN, by: 'self-draw', wasReplacementDraw: true, kongChain: 1 }));
    expect(names(kong)).toEqual(expect.arrayContaining(['槓上開花', '自摸']));
    const double = score(ctx({ concealed: CHICKEN, by: 'self-draw', wasReplacementDraw: true, kongChain: 2 }));
    expect(double.breakdown).toContainEqual({ name: '槓上槓', tai: 8 });
    expect(names(double)).not.toContain('槓上開花');
    expect(names(score(ctx({ concealed: CHICKEN, wasKongRob: true })))).toContain('搶槓');
    expect(names(score(ctx({ concealed: CHICKEN, wasLastTile: true })))).toContain('海底撈月');
  });
});

describe('limit hands', () => {
  it('十三么 is 13, and the extras do not add to a limit hand', () => {
    const r = score(ctx({ concealed: THIRTEEN, by: 'self-draw', madeNoClaims: true, flowers: [] }));
    expect(r.tai).toBe(13);
    expect(names(r)).toEqual(['十三么']);
  });
  it('the 10s: 字一色, 坎坎糊, 清么九, 九子連環', () => {
    expect(score(ctx({ concealed: ALL_HONOURS })).tai).toBe(10);
    expect(score(ctx({ concealed: ALL_PUNGS, by: 'self-draw', madeNoClaims: true })).breakdown)
      .toContainEqual({ name: '坎坎糊', tai: 10 });
    expect(score(ctx({ concealed: ALL_TERMINALS })).tai).toBe(10);
    expect(score(ctx({ concealed: NINE_GATES, madeNoClaims: true })).tai).toBe(10);
  });
  it('坎坎糊 needs the fourth pung concealed: off a discard it is only 對對糊', () => {
    const r = score(ctx({ concealed: ALL_PUNGS, winTile: '1w', madeNoClaims: true }));
    expect(names(r)).not.toContain('坎坎糊');
    expect(names(r)).toContain('對對糊');
  });
  it('the 13s: 大四喜, 十八羅漢, 天糊, 地糊', () => {
    expect(score(ctx({ concealed: BIG_WINDS })).tai).toBe(13);
    const kongs: Meld[] = (['1w', '5t', '9b', 'dr'] as TileKind[]).map((t) => ({
      type: 'kong', tiles: [t, t, t, t], concealed: false, claimedFrom: 2,
    }));
    expect(score(ctx({ concealed: ['5w', '5w'], melds: kongs })).tai).toBe(13);
    expect(score(ctx({ concealed: CHICKEN, by: 'self-draw', isHeavenly: true })).tai).toBe(13);
    expect(score(ctx({ concealed: CHICKEN, isEarthly: true })).tai).toBe(13);
  });
  it('caps at the house maximum: a 13 is worth 10 under a 10 cap, and so is a big ordinary hand', () => {
    const cap10 = { ...RULES, maxFaan: 10 as const };
    expect(score(ctx({ concealed: THIRTEEN }), cap10).tai).toBe(10);
    // 大三元 8 + 自摸 1 + 門前清 1 + 無花 1 = 11.
    expect(score(ctx({ concealed: BIG_DRAGONS, by: 'self-draw', madeNoClaims: true, flowers: [] }), cap10).tai).toBe(10);
  });
});

describe('payments', () => {
  it('follows the half- and full-spicy tables', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13].map((f) => cantonesePoints(f, 'half')))
      .toEqual([1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 384]);
    expect([0, 3, 5, 10, 13].map((f) => cantonesePoints(f, 'full'))).toEqual([1, 8, 32, 1024, 8192]);
  });
  it('a discard win: the discarder pays it all', () => {
    expect(computeCantonesePayments({ points: 8, winner: 1, by: 'discard', discarder: 3 }))
      .toEqual([0, 8, 0, -8]);
  });
  it('a self-draw: each of the other three pays half', () => {
    const net = computeCantonesePayments({ points: 8, winner: 2, by: 'self-draw', discarder: null });
    expect(net).toEqual([-4, -4, 12, -4]);
    expect(net.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
