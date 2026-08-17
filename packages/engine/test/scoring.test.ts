import { describe, expect, it } from 'vitest';
import { scoreTaiwaneseHand, type ScoreContext } from '../src/scoring/taiwanese.js';
import { computePayments } from '../src/scoring/payments.js';
import { isWinningHand } from '../src/win.js';
import type { Meld } from '../src/melds.js';
import type { TileKind } from '../src/tiles.js';

function ctx(partial: Partial<ScoreContext> & Pick<ScoreContext, 'concealed'>): ScoreContext {
  return {
    melds: [], flowers: [], winTile: partial.concealed[partial.concealed.length - 1]!,
    by: 'discard', winner: 1, dealer: 0, dealerStreak: 0, roundWind: 'E',
    madeNoClaims: true, wasReplacementDraw: false, wasKongRob: false, wasLastTile: false,
    ...partial,
  };
}

/** Every fixture below must be a real winning shape, or the test proves nothing. */
function fixture(name: string, tiles: TileKind[], meldedSets = 0): TileKind[] {
  const expected = 17 - meldedSets * 3;
  if (tiles.length !== expected) {
    throw new Error(`fixture ${name}: expected ${expected} concealed tiles, got ${tiles.length}`);
  }
  if (!isWinningHand(tiles)) {
    throw new Error(`fixture ${name} is not a winning shape: ${tiles.join(' ')}`);
  }
  return tiles;
}

const PINGHU = fixture('平胡', [
  '1w', '2w', '3w', '4w', '5w', '6w', '2t', '3t', '4t',
  '5t', '6t', '7t', '2b', '3b', '4b', '8b', '8b',
]); // all chows, neutral pair; won on 4b (two-sided 1b/4b, so not a single wait)

const FIVE_CHOWS_PAIR_WAIT = fixture('single-wait chows', [
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
  '1t', '2t', '3t', '4t', '5t', '6t', '9b', '9b',
]); // waits only on 9b

const ALL_PUNGS_ONE_SUIT = fixture('碰碰胡+混一色', [
  '1t', '1t', '1t', '3t', '3t', '3t', '5t', '5t', '5t',
  'we', 'we', 'we', 'dr', 'dr', 'dr', '9t', '9t',
]);

describe('tai patterns — one per table row', () => {
  it('自摸 self-draw is 1 tai', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b', by: 'self-draw' }));
    expect(r.breakdown).toContainEqual({ name: '自摸', tai: 1 });
  });

  it('門清 concealed hand is 1 tai', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b' }));
    expect(r.breakdown).toContainEqual({ name: '門清', tai: 1 });
  });

  it('門清自摸 totals 3 tai, not 2', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b', by: 'self-draw' }));
    expect(r.breakdown).toContainEqual({ name: '自摸', tai: 1 });
    expect(r.breakdown).toContainEqual({ name: '門清', tai: 1 });
    expect(r.breakdown).toContainEqual({ name: '門清自摸加台', tai: 1 });
    expect(r.tai).toBe(3); // 平胡 does not apply to a self-draw
  });

  it('花牌 adds 1 tai each', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b', flowers: ['f1', 'f5'] }));
    expect(r.breakdown).toContainEqual({ name: '花牌', tai: 2 });
  });

  it('三元牌 is 1 tai per dragon set', () => {
    const hand = fixture('one dragon pung', [
      'dr', 'dr', 'dr', '1w', '2w', '3w', '4w', '5w', '6w',
      '7w', '8w', '9w', '1t', '2t', '3t', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '三元牌', tai: 1 });
  });

  it('場風 fires for a pung of the round wind', () => {
    const hand = fixture('east pung', [
      'we', 'we', 'we', '1w', '2w', '3w', '4w', '5w', '6w',
      '7w', '8w', '9w', '1t', '2t', '3t', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, roundWind: 'E', winner: 1, dealer: 0 }));
    expect(r.breakdown).toContainEqual({ name: '場風', tai: 1 });
    expect(r.breakdown.filter((b) => b.name === '門風')).toHaveLength(0);
  });

  it('門風 fires for a pung of the winner own seat wind', () => {
    // winner 1 with dealer 0 sits South, so ws is their seat wind. Round is West
    // so 場風 cannot also fire.
    const hand = fixture('south pung', [
      'ws', 'ws', 'ws', '1w', '2w', '3w', '4w', '5w', '6w',
      '7w', '8w', '9w', '1t', '2t', '3t', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, roundWind: 'W', winner: 1, dealer: 0 }));
    expect(r.breakdown).toContainEqual({ name: '門風', tai: 1 });
    expect(r.breakdown.filter((b) => b.name === '場風')).toHaveLength(0);
  });

  it('獨聽 fires when exactly one tile completes the hand', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: FIVE_CHOWS_PAIR_WAIT, winTile: '9b' }));
    expect(r.breakdown).toContainEqual({ name: '獨聽', tai: 1 });
    // and it disqualifies 平胡, which requires a non-single wait
    expect(r.breakdown.filter((b) => b.name === '平胡')).toHaveLength(0);
  });

  it('槓上開花 needs a replacement draw AND a self-draw', () => {
    const win = ctx({ concealed: PINGHU, winTile: '4b', by: 'self-draw', wasReplacementDraw: true });
    expect(scoreTaiwaneseHand(win).breakdown).toContainEqual({ name: '槓上開花', tai: 1 });
    const onDiscard = scoreTaiwaneseHand(ctx({
      concealed: PINGHU, winTile: '4b', by: 'discard', wasReplacementDraw: true,
    }));
    expect(onDiscard.breakdown.filter((b) => b.name === '槓上開花')).toHaveLength(0);
  });

  it('搶槓 fires on a robbed kong', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b', wasKongRob: true }));
    expect(r.breakdown).toContainEqual({ name: '搶槓', tai: 1 });
  });

  it('海底撈月 needs the last tile AND a self-draw', () => {
    const drawn = ctx({ concealed: PINGHU, winTile: '4b', by: 'self-draw', wasLastTile: true });
    expect(scoreTaiwaneseHand(drawn).breakdown).toContainEqual({ name: '海底撈月', tai: 1 });
    const claimed = scoreTaiwaneseHand(ctx({
      concealed: PINGHU, winTile: '4b', by: 'discard', wasLastTile: true,
    }));
    expect(claimed.breakdown.filter((b) => b.name === '海底撈月')).toHaveLength(0);
  });

  it('scores 平胡 as 2 tai (+1 門清)', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b' }));
    expect(r.breakdown).toContainEqual({ name: '平胡', tai: 2 });
    expect(r.breakdown).toContainEqual({ name: '門清', tai: 1 });
    expect(r.tai).toBe(3);
  });

  it('scores 碰碰胡 + 混一色 together', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: ALL_PUNGS_ONE_SUIT }));
    expect(r.breakdown).toContainEqual({ name: '碰碰胡', tai: 4 });
    expect(r.breakdown).toContainEqual({ name: '混一色', tai: 4 });
    expect(r.breakdown).toContainEqual({ name: '三元牌', tai: 1 });
  });

  it('scores 清一色 8 tai', () => {
    const hand = fixture('清一色', [
      '1w', '1w', '1w', '2w', '3w', '4w', '5w', '6w', '7w',
      '7w', '8w', '9w', '9w', '9w', '2w', '3w', '4w',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '清一色', tai: 8 });
    expect(r.breakdown.filter((b) => b.name === '混一色')).toHaveLength(0);
  });

  it('scores 小三元 4 tai and suppresses 三元牌', () => {
    const hand = fixture('小三元', [
      'dr', 'dr', 'dr', 'dg', 'dg', 'dg', '1w', '2w', '3w',
      '4w', '5w', '6w', '7w', '8w', '9w', 'dw', 'dw',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: 'dw' }));
    expect(r.breakdown).toContainEqual({ name: '小三元', tai: 4 });
    expect(r.breakdown.filter((b) => b.name === '三元牌')).toHaveLength(0);
  });

  it('大三元 replaces individual dragon tai', () => {
    const hand = fixture('大三元', [
      'dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', 'dw',
      '1w', '2w', '3w', '5t', '6t', '7t', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '大三元', tai: 8 });
    expect(r.breakdown.filter((b) => b.name === '三元牌')).toHaveLength(0);
  });

  it('scores 小四喜 8 tai and suppresses the wind tai', () => {
    const hand = fixture('小四喜', [
      'we', 'we', 'we', 'ws', 'ws', 'ws', 'ww', 'ww', 'ww',
      '1w', '2w', '3w', '4w', '5w', '6w', 'wn', 'wn',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: 'wn', roundWind: 'E' }));
    expect(r.breakdown).toContainEqual({ name: '小四喜', tai: 8 });
    expect(r.breakdown.filter((b) => b.name === '場風')).toHaveLength(0);
    expect(r.breakdown.filter((b) => b.name === '門風')).toHaveLength(0);
  });

  it('scores 大四喜 16 tai and suppresses the wind tai', () => {
    const hand = fixture('大四喜', [
      'we', 'we', 'we', 'ws', 'ws', 'ws', 'ww', 'ww', 'ww',
      'wn', 'wn', 'wn', '1w', '2w', '3w', '9w', '9w',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: '9w', roundWind: 'E' }));
    expect(r.breakdown).toContainEqual({ name: '大四喜', tai: 16 });
    expect(r.breakdown.filter((b) => b.name === '場風')).toHaveLength(0);
    expect(r.breakdown.filter((b) => b.name === '門風')).toHaveLength(0);
  });

  it('scores 字一色 16 tai', () => {
    const hand = fixture('字一色', [
      'dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', 'dw',
      'we', 'we', 'we', 'ws', 'ws', 'ws', 'wn', 'wn',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: 'wn' }));
    expect(r.breakdown).toContainEqual({ name: '字一色', tai: 16 });
    expect(r.breakdown).toContainEqual({ name: '碰碰胡', tai: 4 });
    // one suit + honors must NOT fire on a hand with no suit tiles at all
    expect(r.breakdown.filter((b) => b.name === '混一色')).toHaveLength(0);
  });

  it('scores 四暗刻 5 tai for four self-made pungs', () => {
    const hand = fixture('四暗刻', [
      '1w', '1w', '1w', '2t', '2t', '2t', '3b', '3b', '3b',
      'dr', 'dr', 'dr', '5w', '6w', '7w', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: '9b', by: 'self-draw' }));
    expect(r.breakdown).toContainEqual({ name: '四暗刻', tai: 5 });
    expect(r.breakdown.filter((b) => b.name === '五暗刻')).toHaveLength(0);
  });

  it('scores 五暗刻 8 tai and suppresses 四暗刻', () => {
    const hand = fixture('五暗刻', [
      '1w', '1w', '1w', '2t', '2t', '2t', '3b', '3b', '3b',
      'dr', 'dr', 'dr', 'we', 'we', 'we', '9b', '9b',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: '9b', by: 'self-draw' }));
    expect(r.breakdown).toContainEqual({ name: '五暗刻', tai: 8 });
    expect(r.breakdown.filter((b) => b.name === '四暗刻')).toHaveLength(0);
  });
});

describe('concealment', () => {
  it('a pung completed by a discard is not a concealed pung', () => {
    const hand: TileKind[] = [
      '1w', '1w', '1w', '2t', '2t', '2t', '3b', '3b', '3b',
      'dr', 'dr', 'dr', '5w', '6w', '7w', '9b', '9b',
    ];
    // Winning on dr means that pung was completed by someone else's tile, so
    // only three pungs are truly concealed and 四暗刻 must not fire.
    const onDiscard = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: 'dr', by: 'discard' }));
    expect(onDiscard.breakdown.filter((b) => b.name === '四暗刻')).toHaveLength(0);
    const drawn = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: 'dr', by: 'self-draw' }));
    expect(drawn.breakdown).toContainEqual({ name: '四暗刻', tai: 5 });
  });

  it('an exposed meld denies 門清 but still counts toward patterns', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 0 },
    ];
    const concealed = fixture('with one meld', [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '2t', '3t', '9b', '9b',
    ], 1);
    const r = scoreTaiwaneseHand(ctx({ concealed, melds, madeNoClaims: false, winTile: '9b' }));
    expect(r.breakdown.filter((b) => b.name === '門清')).toHaveLength(0);
    expect(r.breakdown).toContainEqual({ name: '三元牌', tai: 1 });
  });

  it('a concealed kong counts as a concealed pung', () => {
    const melds: Meld[] = [
      { type: 'kong', tiles: ['dr', 'dr', 'dr', 'dr'], concealed: true, claimedFrom: null },
    ];
    const concealed = fixture('kong hand', [
      '1w', '1w', '1w', '2t', '2t', '2t', '3b', '3b', '3b',
      '4w', '5w', '6w', '9b', '9b',
    ], 1);
    const r = scoreTaiwaneseHand(ctx({
      concealed, melds, winTile: '9b', by: 'self-draw',
    }));
    expect(r.breakdown).toContainEqual({ name: '四暗刻', tai: 5 });
    expect(r.breakdown).toContainEqual({ name: '門清', tai: 1 });
  });
});

describe('best reading wins', () => {
  it('reads an ambiguous hand as pungs when that scores higher', () => {
    // 1t1t1t 2t2t2t 3t3t3t 4t4t4t 5t5t5t is five pungs (碰碰胡) or three runs
    // plus two pungs. Only the first reading earns 碰碰胡.
    const hand = fixture('ambiguous', [
      '1t', '1t', '1t', '2t', '2t', '2t', '3t', '3t', '3t',
      '4t', '4t', '4t', '5t', '5t', '5t', '9t', '9t',
    ]);
    const r = scoreTaiwaneseHand(ctx({ concealed: hand, winTile: '9t', by: 'self-draw' }));
    expect(r.breakdown).toContainEqual({ name: '碰碰胡', tai: 4 });
    expect(r.breakdown).toContainEqual({ name: '清一色', tai: 8 });
    expect(r.breakdown).toContainEqual({ name: '五暗刻', tai: 8 });
  });
});

describe('scoring rejects impossible input', () => {
  it('throws when the win tile is not in the concealed hand', () => {
    expect(() => scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '9w' })))
      .toThrow(/winTile/);
  });
  it('throws when asked to score a hand that has not won', () => {
    expect(() => scoreTaiwaneseHand(ctx({
      concealed: ['1w', '3w', '5w', '7w', '9w'], winTile: '9w',
    }))).toThrow(/non-winning/);
  });
});

describe('payments', () => {
  it('discard win: discarder pays alone, sums to zero', () => {
    const p = computePayments({
      tai: 3, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 0,
      by: 'discard', discarder: 2,
    });
    expect(p).toEqual([0, 6, -6, 0]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('self-draw: all three pay; dealer pays extra when involved', () => {
    const p = computePayments({
      tai: 2, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 1,
      by: 'self-draw', discarder: null,
    });
    // dealerExtra = 1 + 2*1 = 3 tai → dealer pays 3+(2+3)=8, others 3+2=5
    expect(p).toEqual([-8, 18, -5, -5]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('dealer as winner collects extra from everyone', () => {
    const p = computePayments({
      tai: 1, base: 3, perTai: 1, winner: 0, dealer: 0, dealerStreak: 0,
      by: 'self-draw', discarder: null,
    });
    // each pays 3+(1+1) = 5
    expect(p).toEqual([15, -5, -5, -5]);
  });
  it('the dealer streak grows the bonus by two tai per repeat (連N拉N)', () => {
    const at = (streak: number) => computePayments({
      tai: 0, base: 0, perTai: 1, winner: 0, dealer: 0, dealerStreak: streak,
      by: 'discard', discarder: 1,
    })[0];
    expect([at(0), at(1), at(2), at(3)]).toEqual([1, 3, 5, 7]);
  });
  it('honours non-default stakes', () => {
    const p = computePayments({
      tai: 2, base: 10, perTai: 5, winner: 2, dealer: 3, dealerStreak: 0,
      by: 'discard', discarder: 1,
    });
    expect(p).toEqual([0, -20, 20, 0]); // 10 + 2*5, dealer uninvolved
  });
  it('always sums to zero across every seat arrangement', () => {
    for (const winner of [0, 1, 2, 3] as const) {
      for (const dealer of [0, 1, 2, 3] as const) {
        for (const streak of [0, 1, 2]) {
          const drawn = computePayments({
            tai: 5, base: 3, perTai: 1, winner, dealer, dealerStreak: streak,
            by: 'self-draw', discarder: null,
          });
          expect(drawn.reduce((a, b) => a + b, 0), `self-draw w${winner} d${dealer}`).toBe(0);
          for (const discarder of [0, 1, 2, 3] as const) {
            if (discarder === winner) continue;
            const claimed = computePayments({
              tai: 5, base: 3, perTai: 1, winner, dealer, dealerStreak: streak,
              by: 'discard', discarder,
            });
            expect(claimed.reduce((a, b) => a + b, 0), `discard w${winner} d${discarder}`).toBe(0);
          }
        }
      }
    }
  });
  it('refuses a discard win with no discarder, or with the winner as discarder', () => {
    expect(() => computePayments({
      tai: 1, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 0,
      by: 'discard', discarder: null,
    })).toThrow(/discarder/);
    expect(() => computePayments({
      tai: 1, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 0,
      by: 'discard', discarder: 1,
    })).toThrow(/own discard/);
  });
});
