/**
 * Every spring, distance and duration the table moves with.
 *
 * Like `tokens`, this is the one place a theme decides how things feel. The
 * general rule: tiles are heavy little objects. They land with a short settle
 * rather than bouncing like rubber, and nothing that responds to a tap takes
 * longer than a blink, because the next tap is already coming.
 */

import type { Edge } from '../state/tableLayout';

export const MOTION = {
  spring: {
    /** A selected tile rising: quick, barely any overshoot. */
    lift: { damping: 16, stiffness: 340, mass: 0.6 },
    /** A tile arriving on the table: lands, settles once. */
    land: { damping: 14, stiffness: 220, mass: 0.7 },
    /** A call-out stamping onto the table: punchy. */
    stamp: { damping: 10, stiffness: 260, mass: 0.7 },
  },
  /** How far a selected tile rises out of the hand, in px. */
  lift: 9,
  /** A tile under the finger shrinks this much, like a key going down. */
  pressScale: 0.94,
  /** Distances tiles travel in from, in px. */
  travel: { deal: 30, draw: 44, discard: 30, meld: 14 },
  duration: {
    press: 90,
    fade: 160,
    /** Roughly how long a landing spring takes to look still. */
    settle: 320,
    /** Gap between consecutive tiles in the opening deal. */
    dealStagger: 30,
    /** How long a claim call-out (碰, 槓…) stays up. */
    calloutHold: 900,
    /** The win call-out stays longer: it is the payoff. */
    winHold: 1300,
    /** The result sheet waits until the closing call-out has lifted (hold + fade). */
    resultDelay: 1460,
    /** One breath of the gold ring around whoever is on turn. */
    turnPulse: 1400,
    /** One rise and fall of a "thinking" dot. */
    thinkingDot: 900,
  },
} as const;

export type EntranceKind = 'deal' | 'draw' | 'discard' | 'meld';

export interface Pose {
  translateX: number;
  translateY: number;
  scale: number;
  opacity: number;
}

/**
 * Where a tile starts before its entrance animates it to rest. Rest is always
 * the identity pose, so only the start needs describing.
 *
 * Every start is fully transparent. A tile that rendered at rest for one frame
 * and then jumped to its start pose would flash in the wrong place first.
 */
export function entrancePose(kind: EntranceKind, from: Edge): Pose {
  const d = MOTION.travel[kind];
  switch (kind) {
    case 'deal':
      return { translateX: 0, translateY: -d, scale: 0.9, opacity: 0 };
    case 'draw':
      return { translateX: 0, translateY: -d, scale: 1.06, opacity: 0 };
    case 'meld':
      return { translateX: 0, translateY: d, scale: 0.92, opacity: 0 };
    case 'discard': {
      // Slapped down from the thrower's side: arrives a little big, as if
      // still in the air, and lands at size.
      const dx = from === 'left' ? -d : from === 'right' ? d : 0;
      const dy = from === 'top' ? -d : from === 'bottom' ? d : 0;
      return { translateX: dx, translateY: dy, scale: 1.3, opacity: 0 };
    }
  }
}

/**
 * How long the result sheet waits after a hand ends. Every ending has its
 * stamp — 胡 or 自摸 for a win, 流局 for a wall run dry — and the sheet waits
 * for it to lift rather than burying it.
 */
export function resultSheetDelay(_ending: 'win' | 'draw-exhausted'): number {
  return MOTION.duration.resultDelay;
}

/** Start delay for the `index`th tile of the opening deal. */
export function dealDelay(index: number): number {
  return index * MOTION.duration.dealStagger;
}
