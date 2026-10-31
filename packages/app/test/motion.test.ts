import { assertAtMost, assertEqual, assertThat } from './support';
import { MOTION, dealDelay, entrancePose, type EntranceKind } from '../src/theme/motion';
import type { Edge } from '../src/state/tableLayout';

/**
 * Motion rules worth pinning. Feel is judged on screen, but a few things are
 * plain facts: a tile must never flash at rest before its entrance starts, a
 * discard must come from the thrower's side of the table, and the opening deal
 * must finish before the player wants to act.
 */

const KINDS: EntranceKind[] = ['deal', 'draw', 'discard', 'meld'];
const EDGES: Edge[] = ['bottom', 'right', 'top', 'left'];

describe('entrancePose', () => {
  it('starts every entrance invisible, so nothing pops in before it moves', () => {
    for (const kind of KINDS) {
      for (const from of EDGES) {
        assertEqual(entrancePose(kind, from).opacity, 0, `${kind} from ${from}`);
      }
    }
  });

  it('sends a discard in from the side of the table its thrower sits on', () => {
    // Bottom is me: my tile travels UP from my hand into the middle.
    assertThat(entrancePose('discard', 'bottom').translateY > 0, 'mine should rise from below');
    assertThat(entrancePose('discard', 'top').translateY < 0, 'across should come down');
    assertThat(entrancePose('discard', 'left').translateX < 0, 'left should come from the left');
    assertThat(entrancePose('discard', 'right').translateX > 0, 'right should come from the right');
  });

  it('drops dealt and drawn tiles from above, into the hand', () => {
    assertThat(entrancePose('deal', 'bottom').translateY < 0, 'deal');
    assertThat(entrancePose('draw', 'bottom').translateY < 0, 'draw');
  });
});

describe('the win', () => {
  it('lets the 胡 stamp lift before the result sheet covers it', () => {
    // Overlapping, the stamp showed through the sheet as it faded in, which
    // muddied both. The sheet arrives as the stamp finishes leaving.
    assertThat(
      MOTION.duration.resultDelay >= MOTION.duration.winHold + MOTION.duration.fade,
      'the result sheet covers the win stamp',
    );
  });
});

describe('dealDelay', () => {
  it('cascades left to right', () => {
    for (let i = 1; i < 17; i++) assertThat(dealDelay(i) > dealDelay(i - 1), `tile ${i}`);
  });

  it('finishes a full 17-tile deal inside a second', () => {
    assertAtMost(dealDelay(16) + MOTION.duration.settle, 1000, 'the deal drags');
  });
});
