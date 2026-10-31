import { assertEqual, assertThat } from './support';
import { planMotion } from '../src/state/motionPlan';
import { dealDelay } from '../src/theme/motion';
import { strings } from '../src/strings';
import type { Seat } from '@mahjong/engine';

/**
 * `planMotion` turns table events into what each part of the screen should
 * animate. Mostly bookkeeping — but the bookkeeping is where "the wrong tile
 * flew in" or "the deal replays on every message" bugs would live.
 */

const ME: Seat = 1;

describe('planMotion', () => {
  it('plans nothing when nothing happened', () => {
    const plan = planMotion([], ME, 16);
    assertEqual(Object.keys(plan.hand).length, 0, 'hand entrances');
    assertEqual(plan.dealing, false, 'dealing');
    assertEqual(plan.callouts.length, 0, 'callouts');
  });

  it('deals every tile in my hand, in a cascade', () => {
    const plan = planMotion([{ type: 'deal' }], ME, 16);
    assertEqual(plan.dealing, true, 'dealing');
    for (let i = 0; i < 16; i++) {
      assertEqual(plan.hand[i]?.kind, 'deal', `tile ${i}`);
      assertEqual(plan.hand[i]?.delay, dealDelay(i), `tile ${i} delay`);
    }
  });

  it('drops in only the tile I drew', () => {
    const plan = planMotion([{ type: 'draw', indices: [7] }], ME, 17);
    expect(Object.keys(plan.hand)).toEqual(['7']);
    assertEqual(plan.hand[7]!.kind, 'draw', 'kind');
  });

  it('lands each discard from the thrower’s side of my screen', () => {
    // I am seat 1: seat 2 sits to my right, seat 3 across, seat 0 to my left.
    const plan = planMotion([
      { type: 'discard', seat: 2, tile: '5t' },
      { type: 'discard', seat: 0, tile: '1w' },
    ], ME, 16);
    assertEqual(plan.pondLast[2]?.from, 'right', 'seat 2');
    assertEqual(plan.pondLast[0]?.from, 'left', 'seat 0');
    assertThat(plan.pondLast[3] === undefined, 'seat 3 threw nothing');
  });

  it('calls each claim, flower and win aloud for the seat that made it', () => {
    const plan = planMotion([
      { type: 'claim', seat: 3, meld: 'pung' },
      { type: 'flower', seat: 1 },
      { type: 'win', seat: 3, by: 'self-draw' },
    ], ME, 16);
    expect(plan.callouts.map((c) => [c.seat, c.text, c.big])).toEqual([
      [3, strings.callout.pung, false],
      [1, strings.callout.flower, false],
      [3, strings.callout.selfDraw, true],
    ]);
    assertEqual(plan.freshMeld[3], true, 'seat 3 laid a meld');
  });

  it('does not call out the flowers revealed during the deal', () => {
    const plan = planMotion([{ type: 'deal' }, { type: 'flower', seat: 2 }], ME, 16);
    assertEqual(plan.callouts.length, 0, 'deal flowers');
  });
});
