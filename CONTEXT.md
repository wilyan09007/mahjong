# CONTEXT.md — Codebase Map

Single-file orientation for this repo: what every file is, what it holds, and the
rules that apply across all of them. Read this first; open the spec/plan only for
detail this file points you at.

## How to use this file

**Reading — do this first, every session.** This is the cheap substitute for
opening the 1,700-line plan and the spec. Find the file you need in the tables
below, take its exports and its one-line job, and go straight to that file. Only
open `docs/superpowers/plans/…` when you need a task's step-by-step or its test
fixtures.

**Updating — part of finishing work, not a follow-up chore.** When a task lands,
update this file *in the same commit as the code*, before `git commit`:

1. Flip the file's 📋 to ✅.
2. Correct its exports column to what you actually built — not what the plan
   predicted. Where the two disagree, the code is right and this file follows it.
3. Add any file the plan didn't foresee; delete rows for files you dropped.
4. If a state field, `Action` variant, or phase changed, fix §3's quick-reference
   blocks too — those go stale first and are the most expensive to get wrong.

A row that lies is worse than a missing row: it sends the next agent to a
function that isn't there.

**Project:** Online multiplayer mahjong (4-player, Taiwanese 16-tile in v1).
TypeScript end-to-end — Expo React Native client, Colyseus game server, shared
pure rules engine. Android first, iOS later. Core promise: create a table, share
a link, friends join in seconds.

**Status legend:** ✅ exists on disk · 📋 planned (not yet written) · the "Plan"
column names the task that creates it.

---

## 1. Current repo state

Plan 1 is complete: the pnpm monorepo is up and `@mahjong/engine` is fully
implemented and tested. `packages/server`, `packages/bot`, and `packages/app`
do not exist yet — Plans 2–4 have not been written.

| File | Status | What it is |
|---|---|---|
| `VERSION` | ✅ | Four-digit release version (`MAJOR.MINOR.PATCH.MICRO`) read by the `/ship` workflow. |
| `docs/superpowers/specs/2026-08-16-mahjong-app-design.md` | ✅ | **Approved design spec.** Product decisions (variants, monetization, identity), 4-package architecture, per-package responsibilities, art direction, testing strategy, v1→v1.2 phasing. The "why" for everything below. |
| `docs/superpowers/plans/2026-08-16-v1-plan-1-engine.md` | ✅ | **Plan 1 (of 4), task-by-task.** Monorepo scaffold + full Taiwanese engine. 12 TDD tasks, each with exact exports, failing tests first, then implementation, then a commit. Contains near-complete source for `tiles.ts`, `wall.ts`, `melds.ts`, `win.ts`, `deal.ts`, `payments.ts`. |
| `CONTEXT.md` | ✅ | **This file — the read-first map.** Every file in the repo with its key exports and one-line job, the engine's state/action reference, and the cross-cutting rules (tile codes, purity constraints, defaults). Maintained per the "How to use this file" section above; `CLAUDE.md` points agents here at session start. |
| `CLAUDE.md` | ✅ | **Agent entry point**, auto-loaded by Claude Code. Deliberately thin — it routes to this file and states the read-first / update-in-the-same-commit rule. Add durable repo-wide rules there only if they must survive without `CONTEXT.md` being read. |

**Plan roadmap:** Plan 1 = engine (written) · Plan 2 = server + bot (write after
Plan 1's API locks) · Plan 3 = Expo app · Plan 4 = EAS build + Play Store.

---

## 2. Target architecture

```
mahjong/
├── package.json            ✅ private root; scripts: test, typecheck
├── pnpm-workspace.yaml     ✅ packages/*
├── tsconfig.base.json      ✅ strict, ES2022, ESNext, bundler resolution,
│                              noUncheckedIndexedAccess
├── .gitignore              ✅ node_modules/ dist/ .expo/ *.tsbuildinfo
├── VERSION                 ✅ 4-digit ship version
└── packages/
    ├── engine/  ✅ Pure rules logic. No UI, no network, no I/O. Plan 1.
    ├── server/  📋 Authoritative Colyseus server; runs bots in-process. Plan 2.
    ├── bot/     📋 AI player. Depends only on engine. Plan 2.
    └── app/     📋 Expo React Native client. Plan 3.
```

Dependency direction is one-way: `app` → (network) → `server` → `engine`,
`bot` → `engine`. The engine never imports from the others.

---

## 3. `packages/engine` — the rules (Plan 1)

Package `@mahjong/engine`, `type: module`, `main: src/index.ts`. Zero runtime
dependencies. Vitest for tests. Every `src/*.ts` has a matching `test/*.test.ts`.

**The whole engine is three functions:**
`newHand(args) → GameState` · `legalActions(state, seat) → Action[]` ·
`applyAction(state, action) → GameState`.

### Source files

| File | Status | Plan | Key exports | What it does |
|---|---|---|---|---|
| `src/tiles.ts` | ✅ | Task 2 | Types: `SuitCode`, `Rank`, `SuitTileKind`, `WindKind`, `DragonKind`, `HonorKind`, `FlowerKind`, `TileKind`, `Seat`, `Wind`. Consts: `SUIT_KINDS`(27), `WINDS`(4), `DRAGONS`(3), `FLOWERS`(8), `NON_FLOWER_KINDS`(34), `FULL_TILE_SET`(144). Fns: `isFlower`, `isSuitTile`, `isHonor`, `rankOf`, `suitOf`, `sortTiles`, `kindIndex`, `seatWind` | The vocabulary every other file speaks. Tile kinds, the full 144-tile set, classification/sorting helpers, and the 0–33 `kindIndex` used by win detection's count arrays. `seatWind(seat, dealer)` gives E/S/W/N relative to the dealer. Unknown tile codes throw rather than sorting as NaN. |
| `src/wall.ts` | 📋 | Task 3 | `mulberry32(seed)`, `buildWall(seed)` | The engine's *only* source of randomness. `buildWall` returns a deterministic shuffled copy of the 144 tiles. The array is never mutated after creation — draws move the `wallFront`/`wallBack` indexes instead. |
| `src/melds.ts` | 📋 | Task 4 | `MeldType`, `Meld`, `chowOptions`, `canPung`, `canExposedKong`, `concealedKongOptions`, `addedKongOptions` | Meld shape and pure legality predicates. `Meld = { type, tiles, concealed, claimedFrom }`. No state, no turn logic — just "can this hand claim this tile?" |
| `src/win.ts` | 📋 | Task 5 | `isWinningHand`, `decomposeWin`, `winningTiles` | Win-shape detection over a 34-slot count array with recursive set removal. Win = N sets + exactly one pair (`len % 3 === 2`). `decomposeWin` returns one valid `{ sets, pair }` (kongs live in melds, never here). `winningTiles` lists the kinds that complete a `len % 3 === 1` hand — also used for the 獨聽 single-wait tai. |
| `src/deal.ts` | 📋 | Task 6 | `dealHands(tiles, dealer)` | The opening deal: 16 per seat (+1 to the dealer) from the wall front, then repeated flower exposure/replacement from the wall back until no hand holds a flower. Returns hands, flowers, and the resulting `wallFront`/`wallBack`. |
| `src/game.ts` | 📋 | Tasks 6–9, 11 | `IllegalActionError`, `Phase`, `PlayerState`, `HandRules`, `DEFAULT_RULES`, `GameState`, `HandResult`, `Action`, `WALL_FLOOR`, `newHand`, `legalActions`, `applyAction` | **The core state machine and the file you'll touch most.** Holds the state shape, the reducer, turn flow (discard → claim window → draw), flower auto-replacement, both kong flows, robbing the kong, exhaustive draw, and result assembly. Grows across four tasks; see the state/action reference below. |
| `src/claims.ts` | 📋 | Task 8 | `ClaimKind`, `ClaimOption`, `PendingClaims`, `computeClaimOptions`, `resolveClaims` | The claim window on a discard. Computes every legal claim (chow only for the seat after the discarder; the discarder never claims own tile) and resolves priority once all eligible seats respond: **win > kong = pung > chow**; among multiple wins, the seat closest after the discarder. All passed → `null`. |
| `src/scoring/taiwanese.ts` | 📋 | Task 10 | `TaiItem`, `ScoreContext`, `scoreTaiwaneseHand` | The 22-row tai table as small named predicates (`isAllPungs`, `isHalfFlush`, `dragonSetCount`, …) over `{sets, pair, melds, flowers, ctx}`. Handles suppression rules — 大三元/小三元 replace individual 三元牌, 大四喜/小四喜 replace wind tai, 五暗刻 replaces 四暗刻. Returns `{ tai, breakdown }`; the breakdown is what the Results screen renders line-by-line. |
| `src/scoring/payments.ts` | 📋 | Task 10 | `computePayments(args)` | Turns tai into per-seat net points summing to zero. Dealer involvement lives *here*, not in the tai table: `dealerExtra = 1 + 2 * dealerStreak` tai added when payer or payee is the dealer. Self-draw → all three pay; discard win → the discarder alone pays. |
| `src/session.ts` | 📋 | Task 11 | `SessionParams`, `nextHandParams`, `isSessionOver` | Between-hands bookkeeping. Dealer win or exhaustive draw → dealer stays, streak +1. Otherwise the deal advances and the streak resets; when it passes seat 3 → 0 the round wind advances E→S→W→N. `isSessionOver` counts completed laps against the configured round count. |
| `src/variant.ts` | 📋 | Task 11 | `Variant`, `TAIWANESE`, `VARIANTS` registry | The pluggability seam for Cantonese (v1.1). `Variant = { id, handSize, score(ctx) }`. `game.ts` calls `variant.score`, never the Taiwanese module directly — and stores only `variantId: 'taiwanese'` on state, resolving through the `VARIANTS` registry, so `GameState` stays JSON-serializable. |
| `src/index.ts` | 📋 | Tasks 1, 11 | Everything public from Tasks 2–11 | The package's public surface. The simulation test imports from here only, proving this surface is enough to run complete games — which is exactly how the server and bots consume it. |
| `README.md` | 📋 | Task 12 | — | Consumer guide: the three-function contract, tile-code table, phase machine, tai table, and the warning that the server must never send `tiles`, `wallFront/Back`, or other players' `hand` to clients. |

### `GameState` at a glance

```ts
{ seed, tiles,                      // fixed shuffled 144, never mutated
  wallFront, wallBack,              // draw indexes: front = normal, back = replacements
  dealer, dealerStreak, roundWind, rules,   // rules = { base: 3, perTai: 1 }
  turn, phase,                      // 'awaiting-discard' | 'awaiting-claims' | 'finished'
  players: [PlayerState × 4],       // { hand (sorted), melds, flowers, discards }
  lastDiscard, pendingClaims, pendingKong,
  lastDrawWasReplacement,           // 槓上開花
  wasKongRob,                       // 搶槓
  wasLastTile,                      // 海底撈月
  result }                          // HandResult | null
```

`HandResult` = `{ type: 'win', winner, by, discarder, tai, breakdown, payments, winningHand }`
or `{ type: 'draw-exhausted' }`.

### `Action` union

`discard` · `self-win` · `concealed-kong` · `added-kong` · `claim` (chow/pung/kong/win,
chow carries `chowTiles`) · `pass`. Anything illegal throws `IllegalActionError`.

### Test files

One per source module, plus `test/simulation.test.ts` (Task 12) — 200 random
full games asserting 144 tiles are always conserved, some seat can always act,
payments always sum to zero, and no hand ever exceeds 1000 steps. **A simulation
failure is a real engine bug; fix the engine, never weaken the invariant.**

---

## 4. `packages/server` — authoritative multiplayer (Plan 2, not yet planned)

From the spec:

- **Owns all hidden information.** Wall and hands live only in server memory;
  each client gets a Colyseus-filtered view — own hand, everyone's melds and
  discards, wall count, never opponents' concealed tiles.
- **Room lifecycle:** host creates → 6-character join code + deep link → players
  join → host picks variant and house rules, fills empty seats with bots →
  start. Rooms are ephemeral; no database in v1.
- **Validates every action against the engine**; illegal actions are rejected.
  Claim windows with priority resolution and a configurable timer.
- **Disconnects:** seat held for the whole game, a bot takes over instantly, the
  player resumes on reconnect. The other three never wait.
- **Hosting:** persistent Node host (Fly.io / Railway class). State is in-memory,
  so a process death loses in-flight games — accepted v1 limitation.

## 5. `packages/bot` — AI seat-filler (Plan 2, not yet planned)

Consumes only the engine's legal-move and hand-evaluation APIs. Discard policy =
shanten minimization + basic tile safety; claim policy = accept melds that
improve expected hand value. Target strength: competent intermediate. Runs
in-process in the server — a bot is just a seat whose actions come from code.

## 6. `packages/app` — Expo React Native client (Plan 3, not yet planned)

Rendering: React Native Skia (tile bevels, gloss, shadows, felt) + Reanimated
(60fps deal/draw/discard/win). Screens:

| Screen | Ships | Holds |
|---|---|---|
| Home | v1 | Display name + avatar; Create table / Join table by link or code |
| Room lobby | v1 | Seats, share-sheet invite, variant picker, house-rule toggles, fill-with-bot, host start |
| Game table (landscape) | v1 | Own hand with tap/drag discard; discard pond + wall count center; opponents' melds and discards; chow/pung/kong/win buttons shown only when legal; turn timer; emotes (no free-text chat, no voice) |
| Results | v1 | Winning hand with line-by-line scoring breakdown (doubles as scoring education) + running session totals |
| Store/themes | v1.2 | Browse/apply cosmetics; rewarded-ad temporary unlocks |

Art is vector-first: 42 unique SVG tile faces under shared design tokens. A
theme is a swappable asset pack (faces, backs, table, sounds) — so every future
cosmetic is content, not engineering.

---

## 7. Cross-cutting rules (apply everywhere)

**Tile codes — used in all code and tests:** suits `1w`–`9w` (characters 萬),
`1t`–`9t` (dots 筒), `1b`–`9b` (bamboo 條); winds `we ws ww wn`; dragons
`dr dg dw` (red 中, green 發, white 白); flowers `f1`–`f8`. Seats are `0|1|2|3`.

**Engine purity:** no I/O, no `Date.now()`, no `Math.random()` — randomness only
through `mulberry32` in `wall.ts`. `applyAction` never mutates its input
(`structuredClone` the draft). Illegal actions throw `IllegalActionError`, never
fail silently.

**Defaults:** base (底) = 3 points, per-tai (台) = 1 — both parameters, never
hardcoded outside the defaults. Chow from the left player only. Dealer holds 17
tiles, everyone else 16.

**Toolchain:** Node ≥ 20, pnpm ≥ 9 (`corepack enable`), TypeScript `strict`.
`pnpm test` / `pnpm typecheck` at the root run recursively;
`pnpm -F @mahjong/engine test` targets one package.

**Commits:** conventional (`feat:`, `test:`, `chore:`), one per plan task.

**Monetization guardrails (product constraint, affects code):** coins/points are
score-keeping only — never purchasable, never cash-out-able. Cosmetics sold
directly, never randomized. Rewarded video only, never during play. This keeps
the app out of the stores' "simulated gambling" classification.

---

*Finishing a task means updating this file in the same commit — see "How to use
this file" at the top for exactly what to touch.*
