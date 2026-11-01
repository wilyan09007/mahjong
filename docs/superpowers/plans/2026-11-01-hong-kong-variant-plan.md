# Hong Kong variant — implementation plan

Spec: `docs/superpowers/specs/2026-11-01-hong-kong-variant.md`. Every task is
written failing-test-first; `pnpm test` and `pnpm typecheck` green before each
commit.

1. **Variant seam grows.** `Variant` gains `isWinningShape`, `meetsMinimum`,
   `payments`; `score` takes the rules. `HandRules` gains an optional
   `cantonese` block. `game.ts` routes every win path (self-draw, claim, robbing
   a kong, legal actions) through one variant-aware check. Taiwanese behaviour
   unchanged — the existing suite is the regression net.
2. **13-tile deal.** `dealHands` takes the hand size; invariants read it from
   the variant.
3. **Special shapes.** `isSevenPairs`, `isThirteenOrphans` in `win.ts`.
4. **番 scorer.** `scoring/cantonese.ts`: patterns, extras, suppression, limit
   hands, cap, best reading; heavenly/earthly hands and the kong chain come
   from new `ScoreContext` fields set by `game.ts`.
5. **Payments.** Half/full-spicy tables; discard pays full, self-draw half each.
6. **Minimum gate + simulation.** Wins under the minimum are never legal;
   full-game simulation with invariants for Hong Kong at every option.
7. **Server.** Room config carries `variant` and the Hong Kong options; hands
   start with them.
8. **App.** Lobby ruleset picker and options; score sheet in 番.
9. **Verify** a full recorded Hong Kong hand on web; docs.
