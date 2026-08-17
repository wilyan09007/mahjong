# TODOS

Open work, grouped by component then priority (P0 highest through P4).
Completed items move to the bottom with the version that shipped them.

## Roadmap

### Write Plan 2 — server + bot
**Priority:** P1
Plan 1's engine API is now locked and exercised by 183 tests, which was the
stated precondition for writing Plan 2. Covers `@mahjong/server` (Colyseus
rooms, per-client filtered state, join codes and deep links, claim timers,
disconnect takeover and reconnection) and `@mahjong/bot` (shanten-based discard
policy, claim policy, running in-process as a seat).

### Write Plan 3 — Expo React Native client
**Priority:** P2
Home, room lobby, landscape game table, and results screens. Skia rendering
plus Reanimated. 42 SVG tile faces under shared design tokens.

### Write Plan 4 — delivery
**Priority:** P3
EAS build config for the Android AAB, Play Store listing and submission.

## packages/engine

### Session length cannot express a 4-round (全莊) game
**Priority:** P2
`isSessionOver` accepts `totalRounds` 1–3 and throws for 4. `SessionParams` has
no lap counter — the round wind is the counter — and it wraps N→E, so "four
rounds finished" and "no rounds finished" are the same state. The engine throws
and names the fix rather than ending a session at the wrong time.

**Fix:** add `roundsCompleted: number` to `SessionParams`, increment it where
the round wind advances in `nextHandParams`, and read it in `isSessionOver` and
`roundsCompleted`. Deliberately deferred to Plan 2 because room configuration is
what will actually expose the round count to players, and because `SessionParams`
is a shape Plan 1's contract pins down.
**Noticed:** v0.1.0.0, on branch `feat/v1-plan-1-engine`.

### House rules beyond stakes are not modelled
**Priority:** P3
`HandRules` carries only `base` and `perTai`. The spec's room lobby also offers
a turn timer and a round count, and mentions configurable house rules generally.
The timer is a server concern (no clock may enter the engine), but the round
count and any rule that changes legality — for example whether a discarded tile
may be robbed, or table-specific tai values — needs a home in `HandRules` or the
`Variant`.

### Cantonese variant (v1.1)
**Priority:** P4
`VARIANTS` has the seam and `resolveVariant` throws for `'cantonese'` today.
Needs a 13-tile hand size, its own scoring module and its own test table.
Blocked on nothing technical — it is scheduled for v1.1.

## Completed

- **Plan 1 — monorepo scaffold + Taiwanese rules engine.** All 12 tasks:
  tiles, wall, melds, win detection, deal, turn flow, claims, kongs, scoring,
  session/variant, diagnostics, simulation and README.
  **Completed:** v0.1.0.0 (2026-08-17)
