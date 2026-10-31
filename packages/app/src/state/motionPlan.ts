/**
 * From "what happened" to "what moves where".
 *
 * `tableEvents` names the change; this decides which tiles animate in, from
 * which side, and what gets called aloud. Pure, so the table screen holds no
 * animation logic of its own — it hands the plan to the components.
 */

import type { Seat } from '@mahjong/engine';
import type { TileEntrance } from '../tiles/Tile';
import { dealDelay } from '../theme/motion';
import { strings } from '../strings';
import { edgeFor } from './tableLayout';
import type { TableEvent } from './tableEvents';

export interface Callout {
  seat: Seat;
  text: string;
  /** Wins get the big treatment. */
  big: boolean;
  /** Muted, for a hand nobody won. */
  muted?: boolean;
}

export interface MotionPlan {
  /** Entrances for tiles in my hand, by index. */
  hand: Record<number, TileEntrance>;
  /** A new hand is being dealt: everyone's tiles cascade in. */
  dealing: boolean;
  /** The newest tile in each seat's pond lands this way. */
  pondLast: Partial<Record<Seat, TileEntrance>>;
  /** Seats whose last meld was just laid down. */
  freshMeld: Partial<Record<Seat, true>>;
  callouts: Callout[];
}

export function planMotion(events: TableEvent[], mySeat: Seat, handSize: number): MotionPlan {
  const plan: MotionPlan = { hand: {}, dealing: false, pondLast: {}, freshMeld: {}, callouts: [] };
  const dealing = events.some((e) => e.type === 'deal');

  for (const e of events) {
    switch (e.type) {
      case 'deal':
        plan.dealing = true;
        for (let i = 0; i < handSize; i++) plan.hand[i] = { kind: 'deal', delay: dealDelay(i) };
        break;
      case 'draw':
        for (const i of e.indices) plan.hand[i] = { kind: 'draw' };
        break;
      case 'discard':
        plan.pondLast[e.seat] = { kind: 'discard', from: edgeFor(mySeat, e.seat) };
        break;
      case 'claim':
        plan.freshMeld[e.seat] = true;
        plan.callouts.push({ seat: e.seat, text: strings.callout[e.meld], big: false });
        break;
      case 'flower':
        // Flowers revealed in the opening deal are routine; only a flower drawn
        // mid-hand is news.
        if (!dealing) plan.callouts.push({ seat: e.seat, text: strings.callout.flower, big: false });
        break;
      case 'win':
        plan.callouts.push({
          seat: e.seat,
          text: e.by === 'self-draw' ? strings.callout.selfDraw : strings.callout.win,
          big: true,
        });
        break;
      case 'exhausted':
        plan.callouts.push({ seat: mySeat, text: strings.callout.exhausted, big: true, muted: true });
        break;
    }
  }
  return plan;
}
