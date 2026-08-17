# @mahjong/engine

Taiwanese 16-tile mahjong rules, as a pure state machine. No UI, no network,
no I/O, no clock, no `Math.random()`. Zero runtime dependencies.

```bash
pnpm -F @mahjong/engine test        # 173 tests
pnpm -F @mahjong/engine typecheck
MAHJONG_DEBUG=1 pnpm -F @mahjong/engine test   # per-hand simulation summaries
```

## ⚠️ For server authors: this state is not safe to send to clients

`GameState` holds **all** hidden information. Never send a client:

| Field | Why |
|---|---|
| `tiles` | The entire shuffled wall, in order. Whoever has it knows every future draw. |
| `wallFront` / `wallBack` | Combined with `tiles`, they say exactly what comes next. |
| `players[other].hand` | Another player's concealed tiles. |
| `seed` | Regenerates `tiles` outright. `buildWall(seed)` is deterministic. |

A client may safely see: its own `hand`, everyone's `melds`, `flowers` and
`discards`, `wallBack - wallFront + 1` as a wall **count**, `turn`, `phase`,
`lastDiscard`, the claim options addressed to it, and `result`.

## The whole contract is three functions

```ts
import { newHand, legalActions, applyAction } from '@mahjong/engine';

let state = newHand({ seed: 42, dealer: 0, dealerStreak: 0, roundWind: 'E' });

while (state.phase !== 'finished') {
  const seat = ([0, 1, 2, 3] as const).find((s) => legalActions(state, s).length > 0)!;
  const options = legalActions(state, seat);   // only ever legal actions
  state = applyAction(state, options[0]!);     // returns a NEW state
}

console.log(state.result);
```

- `applyAction` never mutates its input. It `structuredClone`s a draft.
- Anything illegal throws `IllegalActionError` naming the seat, action, phase,
  whose turn it is and the wall count. Nothing ever fails silently.
- Same seed + same actions = same result, always. A bug reproduces from its seed.

## Tile codes

| Group | Codes | |
|---|---|---|
| Characters 萬 | `1w`–`9w` | |
| Dots 筒 | `1t`–`9t` | |
| Bamboo 條 | `1b`–`9b` | |
| Winds | `we` `ws` `ww` `wn` | 東 南 西 北 |
| Dragons | `dr` `dg` `dw` | 中 發 白 |
| Flowers | `f1`–`f8` | one of each, never in a hand |

34 non-flower kinds × 4 copies + 8 flowers = **144**. Seats are `0 | 1 | 2 | 3`.
`sortTiles` orders 萬 → 筒 → 條 → winds → dragons → flowers.

## Phases

```
                 ┌──────────────────────────────────────────┐
                 │                                          │
   newHand ──▶ awaiting-discard ──discard──▶ awaiting-claims │
                 ▲   │      ▲                   │    │      │
      claim chow/│   │      └───kong replacement┘    │ all pass
      pung ──────┘   │                              │  ──────┘
                     │                          claim win
              self-win / kong                       │
                     │                              ▼
                     └──────────────────────▶   finished
                                                (or wall floor
                                                 → draw-exhausted)
```

- **awaiting-discard** — only `turn` may act: `discard`, `self-win`,
  `concealed-kong`, `added-kong`.
- **awaiting-claims** — every eligible seat answers `claim` or `pass`. The
  window closes when all have answered. Priority: **win > kong = pung > chow**,
  ties broken by seat order after the tile's origin. Chow is offered only to
  the seat on the discarder's left; the discarder never claims their own tile.
  An added kong opens the same window in win-only mode (搶槓).
- **finished** — `result` is a win or `draw-exhausted`. `legalActions` returns
  `[]` for everyone and `applyAction` throws.

The hand ends in an exhaustive draw when the live wall reaches `WALL_FLOOR`
(16 tiles). Those are never drawn.

## Hand sizes

Every seat is worth **16**; the seat on turn holds **17** until it discards, and
the winner keeps 17. A kong is four tiles but three "slots" — its replacement
draw restores the count. So `hand.length + melds.length * 3` is the number to
check, not `hand.length`.

## Scoring — the v1 tai table

Verified against [台灣十六張麻將台數表](https://www.minwt.com/life/7062.html).

| Pattern | Tai | | Pattern | Tai |
|---|---|---|---|---|
| 自摸 self-draw | 1 | | 平胡 all chows | 2 |
| 門清 concealed | 1 | | 碰碰胡 all pungs | 4 |
| 門清自摸加台 | +1 | | 混一色 half flush | 4 |
| 花牌 per flower | 1 | | 小三元 | 4 |
| 三元牌 per dragon set | 1 | | 四暗刻 | 5 |
| 場風 round wind | 1 | | 清一色 full flush | 8 |
| 門風 seat wind | 1 | | 大三元 | 8 |
| 獨聽 single wait | 1 | | 小四喜 | 8 |
| 槓上開花 | 1 | | 五暗刻 | 8 |
| 搶槓 | 1 | | 大四喜 | 16 |
| 海底撈月 | 1 | | 字一色 all honors | 16 |

**Suppression:** 大三元/小三元 replace 三元牌 · 大四喜/小四喜 replace 場風 and
門風 · 五暗刻 replaces 四暗刻.

**The best reading wins.** The same tiles are often two hands at once —
`1t1t1t 2t2t2t 3t3t3t` is three pungs *or* three runs — and only one earns
碰碰胡. Every reading from `decomposeWinAll` is scored and the highest kept.

**Dealer bonus is not a tai.** It is a property of a *payment*, and lives in
`computePayments`: 連N拉N = `1 + 2 * dealerStreak` extra tai on any payment the
dealer is on either end of. Self-draw → all three losers pay. Discard win → the
discarder pays alone. Payments always sum to zero.

Stakes are parameters: `rules = { base: 3, perTai: 1 }` by default (3底1台).

## When something goes wrong

The engine is pure, so there is nothing to attach a debugger to on a server.
Use the renderers instead — they all **return** strings, they never print:

```ts
import { formatState, traceAction, traceHand, assertInvariants } from '@mahjong/engine';

console.log(formatState(state));              // paste this into the bug report
const { next, log } = traceAction(state, action);  // what did this change?
assertInvariants(state, 'after claim');       // throws with every violation + the state
```

`checkInvariants` verifies exact multiset tile conservation against the original
wall (not just "144 things exist"), wall indexes, sorted flower-free hands,
well-formed melds, the 16/17 hand-value rule, phase↔claims↔result consistency,
and zero-sum payments. **A violation is always an engine bug — fix the engine,
never weaken the invariant.**

## Variants

`GameState` stores `variantId`, never a function, so it stays plain JSON —
cloneable here, serialisable straight down a socket. `resolveVariant` looks the
implementation up in `VARIANTS` and throws if it is missing. Cantonese (v1.1)
is deliberately absent rather than stubbed.

## Known limit

`isSessionOver` accepts `totalRounds` **1–3**. `SessionParams` carries no lap
counter — the round wind is the counter — and it wraps N→E, so a 4-round 全莊
session is indistinguishable from a fresh one. It throws and names the fix (add
a `roundsCompleted` field) rather than ending a session at the wrong time.
