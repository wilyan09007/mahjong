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

Plans 1–4 are implemented: the monorepo, `@mahjong/engine`, `@mahjong/bot`,
`@mahjong/server`, `@mahjong/app`, and the delivery artifacts (342 tests,
`pnpm test` and `pnpm typecheck` green).

The app has been **played end to end on Expo web at phone-landscape size**
(880x400) against a live server with three bots — create table, join code,
bots claiming pungs, flowers, discards, scoring. Test at that viewport, not a
desktop window: the first pass was done at 1100x900 and the table looked fine
while actually being unusable on a phone.

It has **not** been run on an Android device or emulator, so touch accuracy,
landscape lock, frame rate and on-phone colour are unverified. Nothing is
deployed. See `TODOS.md`, which leads with what is blocked on you.

**To run it yourself** (web, no emulator needed):

```bash
pnpm dev:server                                  # game server on :2567
cd packages/app
EXPO_PUBLIC_SERVER_URL=http://localhost:2567 npx expo start --web --port 8090
```

`/dev-gallery` shows all 42 faces at every size — the screen the art gets
judged on.

| File | Status | What it is |
|---|---|---|
| `VERSION` | ✅ | Four-digit release version (`MAJOR.MINOR.PATCH.MICRO`) read by the `/ship` workflow. |
| `CHANGELOG.md` | ✅ | Per-version record of what changed, written for the developer consuming the engine. |
| `TODOS.md` | ✅ | Open work grouped by component then priority (P0–P4), with a Completed section at the bottom. Holds the Plan 2–4 roadmap and the engine's known limits. |
| `packages/engine/README.md` | ✅ | Consumer guide for the engine — three-function contract, tile codes, phase diagram, tai table, debugging entry points, and the list of `GameState` fields a server must never send a client. |
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
    ├── server/  ✅ Authoritative Colyseus server; runs bots in-process. Plan 2.
    ├── bot/     ✅ AI player. Depends only on engine. Plan 2.
    └── app/     ✅ Expo React Native client. Plan 3. (played on web, not on device)
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
| `src/wall.ts` | ✅ | Task 3 | `mulberry32(seed)`, `buildWall(seed)` | The engine's *only* source of randomness. `buildWall` returns a deterministic shuffled copy of the 144 tiles. The array is never mutated after creation — draws move the `wallFront`/`wallBack` indexes instead. |
| `src/melds.ts` | ✅ | Task 4 | `MeldType`, `Meld`, `chowOptions`, `canPung`, `canExposedKong`, `concealedKongOptions`, `addedKongOptions` | Meld shape and pure legality predicates. `Meld = { type, tiles, concealed, claimedFrom }`. No state, no turn logic — just "can this hand claim this tile?" |
| `src/win.ts` | ✅ | Task 5 | `WinDecomposition`, `isWinningHand`, `decomposeWin`, `decomposeWinAll`, `winningTiles` | Win-shape detection over a 34-slot count array with recursive set removal. Win = N sets + exactly one pair (`len % 3 === 2`). `decomposeWin` returns one valid `{ sets, pair }` (kongs live in melds, never here). `decomposeWinAll` returns EVERY reading — scoring needs it because `1t1t1t 2t2t2t 3t3t3t` is both three pungs (碰碰胡) and three runs, and Taiwanese practice scores the winner best reading. `winningTiles` lists the kinds that complete a `len % 3 === 1` hand — also used for the 獨聽 single-wait tai. |
| `src/deal.ts` | ✅ | Task 6 | `DealResult`, `dealHands(tiles, dealer)` | The opening deal: 16 per seat (+1 to the dealer) from the wall front, then repeated flower exposure/replacement from the wall back until no hand holds a flower. Returns hands, flowers, `wallFront`/`wallBack`, and `dealerLastTile` — the dealer 17th tile, read **before** sorting because sorting destroys the record of which tile arrived last and a 天胡 needs it by identity. |
| `src/game.ts` | ✅ | Tasks 6–9, 11 | `IllegalActionError`, `Phase`, `PlayerState`, `HandRules`, `DEFAULT_RULES`, `WALL_FLOOR`, `GameState`, `HandResult`, `Action`, `newHand`, `legalActions`, `applyAction`; re-exports `ClaimAction`/`ClaimKind`/`ClaimOption`/`PendingClaims` | **The core state machine and the file you'll touch most.** Holds the state shape, the reducer, turn flow (discard → claim window → draw), flower auto-replacement, both kong flows, robbing the kong, exhaustive draw, and result assembly. Grows across four tasks; see the state/action reference below. |
| `src/claims.ts` | ✅ | Task 8 | `ClaimKind`, `ClaimAction`, `ClaimOption`, `PendingClaims`, `computeClaimOptions`, `eligibleSeats`, `resolveClaims` | The claim window on a discard. Computes every legal claim (chow only for the seat after the discarder; the discarder never claims own tile) and resolves priority once all eligible seats respond: **win > kong = pung > chow**, tie-broken by seat order after `from`. All passed → `null`. `PendingClaims = { tile, from, source, options, responses }` — `source` is `discard` or `kong-rob` (Task 9 reuses the same window for 搶槓), and `from`/`tile` are what make the tie-break and execution self-contained. |
| `src/scoring/taiwanese.ts` | ✅ | Task 10 | `TaiItem`, `ScoreContext`, `scoreTaiwaneseHand` | The 22-row tai table. Melds plus one reading of the concealed tiles are normalised into a `Shape` of `ScoredSet { tiles, kind: chow|pung, concealed }` (a kong scores as a pung), and `evaluate(ctx, shape, singleWait)` walks the table over it. Set concealment is per-set, not per-hand: winning on a discard demotes the one pung that tile completed, so a four-pung hand won off a discard cannot claim 四暗刻. Handles suppression rules — 大三元/小三元 replace individual 三元牌, 大四喜/小四喜 replace wind tai, 五暗刻 replaces 四暗刻. Returns `{ tai, breakdown }` for the winner best reading — every `decomposeWinAll` reading is scored and the highest total kept, because the same tiles can be pungs or runs and those score differently. The breakdown is what the Results screen renders line-by-line. Values verified against 台灣十六張麻將台數表 (minwt.com/life/7062.html). |
| `src/scoring/payments.ts` | ✅ | Task 10 | `computePayments(args)` | Turns tai into per-seat net points summing to zero. Dealer involvement lives *here*, not in the tai table: `dealerExtra = 1 + 2 * dealerStreak` tai added when payer or payee is the dealer. Self-draw → all three pay; discard win → the discarder alone pays. |
| `src/session.ts` | ✅ | Task 11, Plan 2 | `SessionParams`, `newSession`, `nextHandParams`, `isSessionOver` | Between-hands bookkeeping. Dealer win or exhaustive draw → dealer stays, streak +1. Otherwise the deal advances and the streak resets; when it passes seat 3 → 0 the round wind advances E→S→W→N and `roundsCompleted` ticks. `SessionParams` carries that explicit lap counter because **the round wind cannot count laps** — it wraps N→E, so four completed rounds read identically to a fresh session. `isSessionOver` accepts **1–4**, so a full 全莊 game works (Plan 2's lobby offers 1/2/4). |
| `src/variant.ts` | ✅ | Task 11 | `VariantId`, `Variant`, `TAIWANESE`, `VARIANTS` registry, `resolveVariant` | The pluggability seam for Cantonese (v1.1). `Variant = { id, handSize, score(ctx) }`. `game.ts` calls `variant.score`, never the Taiwanese module directly — and stores only `variantId: 'taiwanese'` on state, resolving through the `VARIANTS` registry, so `GameState` stays JSON-serializable. |
| `src/view.ts` | ✅ | Plan 2 T1 | `OpponentView`, `PlayerView`, `viewFor(state, seat)` | **The security boundary.** The only function allowed to turn `GameState` into something a client may receive; the server sends `PlayerView`s and nothing else. `OpponentView` has no `hand` field *at all* — not optional, absent — so no server-side spread can leak tiles that were never copied. Everything returned is a copy, so a server/bot/app cannot mutate authoritative state through a view. |
| `src/debug.ts` | ✅ | extra | `formatTile`, `formatTiles`, `formatMeld`, `formatAction`, `formatResult`, `formatPlayer`, `formatState`, `formatLegalActions`, `traceAction`, `traceHand` | **Read this when something is wrong.** Pure renderers — every function RETURNS a string, nothing prints, so the engine stays I/O-free and the caller picks where verbose output goes. `formatState` is the paste-into-a-bug-report dump; `traceAction` applies an action and diffs the before/after (hand sizes, new melds, wall movement, hand-value anomalies); `traceHand` plays a whole hand and returns the transcript. Tile codes are always shown next to glyphs: the code pastes into a fixture, the glyph reads. |
| `src/invariants.ts` | ✅ | extra | `checkInvariants`, `assertInvariants`, `EngineInvariantError` | Structural properties that must hold in EVERY reachable state: exact multiset tile conservation (not just a count of 144), wall index sanity, no flowers in hand, sorted hands, well-formed melds, hand value 16/17, phase↔pendingClaims↔result consistency, payments summing to zero. `checkInvariants` returns every violation; `assertInvariants` throws with all of them plus the full state dump. **A violation is always an engine bug — fix the engine, never weaken the invariant.** |
| `src/index.ts` | ✅ | Tasks 1, 11 | Everything public from Tasks 2–11 | The package's public surface. The simulation test imports from here only, proving this surface is enough to run complete games — which is exactly how the server and bots consume it. |
| `README.md` | ✅ | Task 12 | — | Consumer guide: the three-function contract, tile-code table, phase diagram, hand-size rule, full tai table with suppression, the debugging entry points, and a **red-box warning listing exactly which `GameState` fields a server must never send a client** (`tiles`, `wallFront`/`wallBack`, `seed`, other players' `hand`) alongside what is safe to send. |

### `GameState` at a glance

```ts
{ seed, tiles,                      // fixed shuffled 144, never mutated
  wallFront, wallBack,              // draw indexes: front = normal, back = replacements
  dealer, dealerStreak, roundWind, rules,   // rules = { base: 3, perTai: 1 }
  variantId,                        // 'taiwanese'; resolved via VARIANTS registry
  turn, phase,                      // 'awaiting-discard' | 'awaiting-claims' | 'finished'
  players: [PlayerState × 4],       // { hand (sorted), melds, flowers, discards }
  lastDiscard, pendingClaims, pendingKong,
  drewThisTurn, lastDrawnTile,      // gates self-win; lastDrawnTile IS the 自摸 win tile
  lastDrawWasReplacement,           // 槓上開花
  wasKongRob,                       // 搶槓
  wasLastTile,                      // 海底撈月
  result }                          // HandResult | null
```

`HandResult` = `{ type: 'win', winner, by, discarder, winTile, tai, breakdown, payments, winningHand }`
or `{ type: 'draw-exhausted' }`.

### `Action` union

`discard` · `self-win` · `concealed-kong` · `added-kong` · `claim` (chow/pung/kong/win,
chow carries `chowTiles`) · `pass`. Anything illegal throws `IllegalActionError`.

### Test files

One per source module (`tiles`, `wall`, `melds`, `win`, `deal`, `turnflow`,
`claims`, `kong`, `scoring`, `session`, `debug`), plus `test/simulation.test.ts` and
`test/purity.test.ts` (which enforces the no-I/O, no-clock, no-mocks,
no-skipped-tests rules against the real source tree).
**183 tests, no mocks anywhere** — no `vi.mock`, no stubs, no fakes; every test
drives the real engine with real tiles.

`simulation.test.ts` imports from `../src/index.js` ONLY, which is how we know
the public surface suffices to play complete games. It runs **two** policies
because they prove different things:

- **Uniform random**, 200 hands — explores the state space by taking sequences
  a sensible player never would. It essentially never wins (random discarding
  does not converge on a winning shape), so it cannot cover scoring.
- **Greedy** (win → kong → claim → discard least-connected tile), 200 hands —
  actually reaches wins (~177/200), which is the only way the scoring and
  payment paths run end to end.

Both check `checkInvariants` at every single step and fail with the seed, the
step number, the last 40 actions and a full `formatState` dump. Coverage guards
assert that wins, self-draws and kongs actually occurred — otherwise a policy
change could silently stop testing those paths.

Two white-box files (`claims`, `kong`) overwrite hands to build exact positions
and therefore break tile conservation on purpose; conservation is proved instead
by `turnflow` and `simulation`, which rig nothing.

**A simulation failure is a real engine bug; fix the engine, never weaken the
invariant.** It has already earned its keep twice: it caught `lastDrawnTile`
going stale across a kong (a self-win would have scored 槓上開花 against a tile
no longer in the hand) and an over-strict hand-value invariant that rejected the
winner legitimately holding 17.

---

## 4. `packages/server` — authoritative multiplayer (Plan 2) ✅

**`packages/server/README.md` is the wire-protocol contract** — Plan 3's client
is written against it. Read that before touching messages.

| File | Status | Key exports | What it does |
|---|---|---|---|
| `src/protocol.ts` | ✅ | `SeatKind`, `SeatPublic`, `RoomConfig`, `DEFAULT_ROOM_CONFIG`, `JoinOptions`, `LobbyMessage`, `HandResultMessage`, `SeatStatusMessage`, `SessionEndMessage`, `C2S`, `S2C` | Every wire name and shape in one file, so client and server cannot drift. `SeatPublic` deliberately carries no `playerId`. |
| `src/roomCode.ts` | ✅ | `ROOM_CODE_ALPHABET`, `generateRoomCode`, `normaliseRoomCode`, `isValidRoomCode` | Six characters from a 32-symbol alphabet with I/O/0/1 removed — codes get read aloud and typed off photos. |
| `src/TableRoom.ts` | ✅ | `TableRoom` | The room: code reservation, seats, host controls, bots, game flow, timers, disconnect cover, session loop. `pushViews()` is the ONLY place game data leaves the process. |
| `src/app.config.ts` | ✅ | default `appConfig` | One server definition shared by `index.ts` and every test, so tests exercise production wiring. |
| `src/index.ts` | ✅ | — | `listen(appConfig, PORT)`. |

- **Owns all hidden information.** The authoritative `GameState` is a plain
  object, never a Colyseus schema — schema sync would broadcast one shared state
  to everyone, exactly wrong here. Clients receive only `viewFor` output.
- **Identity is `playerId`, not the connection.** That is what makes rejoining
  reclaim the same seat.
- **Everything scheduled is generation-guarded**, and re-armed after every
  transition — otherwise a claim window deadlocks when the first response
  invalidates the other seats' timers.
- **Known v1 limitation:** one instance only; games die with the process.

## 5. `packages/bot` — AI seat-filler (Plan 2) ✅

| File | Status | Key exports | What it does |
|---|---|---|---|
| `src/shanten.ts` | ✅ | `shanten16(concealed, meldCount)` | Distance to a win: −1 won, 0 tenpai, n otherwise. The tenpai boundary defers to `winningTiles` (exact); the search is consulted first and is a lower bound, so it short-circuits the expensive check. |
| `src/bot.ts` | ✅ | `chooseBotAction(view, rng?)` | Shanten minimisation. Always wins when it can; claims only on a strict improvement; kongs when no worse; ties break honors → terminals → random. |
| `src/index.ts` | ✅ | both of the above | — |

Consumes **only** a `PlayerView`, never `GameState`, so it cannot see the wall
or anyone's hand — which is what makes it honest cover for a dropped player.
Measured at 181 wins / 19 draws per 200 bot-vs-bot hands (random play: 0/200).

## 6. `packages/app` — Expo React Native client (Plan 3) ✅ code, ⚠️ unverified on device

**Built, unit-tested (85 tests), and PLAYED end to end on Expo web** against a
live server with three bots — which found and fixed five visual bugs no unit
test caught (see the v0.2.1.0 changelog). Still never run on a real Android
device or emulator: touch targets, landscape lock, frame rate and on-phone
colour are all unverified. See `TODOS.md` for how to re-run it on web, which is
the fastest feedback loop and needs no emulator.

Expo SDK 57 · React 19 · React Native 0.87 · expo-router · zustand · colyseus.js.

| File | Status | Key exports | What it does |
|---|---|---|---|
| `src/theme/tokens.ts` | ✅ | `tokens`, `TILE_SIZES`, `tileHeight` | Every colour, dimension, radius and duration. No component may hardcode one — the v1.2 cosmetics pipeline depends on there being exactly one place a theme decides things. Names are frozen; values get tuned on-device. |
| `src/strings.ts` | ✅ | `strings`, `EMOTES` | Every user-visible string, for localisation later. |
| `src/tiles/tileData.ts` | ✅ | `FACE_DATA`, `FaceData`, `VIEWBOX`, `STICK_W`, `MIN_STICK_ASPECT`, `STICK_NODE` | All 42 faces as DATA in a 100×140 viewBox, with colours as token *names*. Data rather than 42 SVG files because a described face can be re-skinned and, crucially, **verified** — the tests assert the 5-dot tile has five dots, that no dots or sticks overlap, and that a 條 stick is at least `MIN_STICK_ASPECT` times taller than it is wide, which is the entire visual difference between 條 and 筒. Bamboo stick length is derived from each layout's tightest row gap, so respacing a layout cannot silently produce collisions. `STICK_NODE` holds the node-marking proportions **in the data layer on purpose**: it makes "a node must not swallow the stick" a checkable rule rather than a rendering opinion. |
| `src/tiles/TileFace.tsx` | ✅ | `TileFace` | Renders one face from `FACE_DATA`, scaled to any width. |
| `src/tiles/Tile.tsx` | ✅ | `Tile` | Tile body: ivory face, darker bottom edge for depth, gold border + lift when selected, `tileBack` when face-down. |
| `src/components/Board.tsx` | ✅ | `HandRow`, `MeldGroup`, `DiscardPond`, `OpponentPanel`, `CenterInfo`, `SeatCard` | The board pieces. A concealed kong shows two backs and two faces, as it is laid on a real table. |
| `src/components/Controls.tsx` | ✅ | `Button`, `ActionBar`, `EmotePicker`, `ErrorToast`, `ClaimCountdown` | Buttons come straight from `actionBarModel`, so one exists iff the server would accept it. |
| `src/state/tableLayout.ts` | ✅ | `edgeFor`, `discardGrid`, `isVerticalEdge`, `rotationFor` | Pure seat→edge and pond-grid maths. I am always at the bottom of my own screen. |
| `src/state/selectors.ts` | ✅ | `canStart`, `actionBarModel`, `formatResult`, `rankStandings`, `medalFor`, `seatLabel` | Pure view-model derivations — every branching decision a screen makes, testable without a renderer. |
| `src/state/store.ts` | ✅ | `useGameStore`, `applyServerMessage`, `ServerState`, `MAX_EMOTES` | zustand store **written by server messages only**. `applyServerMessage` is a pure reducer. An `error` never clobbers the `view`; a `view` always clears `pendingAction`. |
| `src/state/codeInput.ts` | ✅ | `normaliseCode`, `isCompleteCode` | Strips punctuation and uppercases what people type off a photo. |
| `src/net/messages.ts` | ✅ | wire types, `S2C`, `C2S` | The client's copy of the protocol. Duplicated from the server on purpose — the app talks over a socket and must not bundle server code. |
| `src/net/connection.ts` | ✅ | `createRoom`, `joinRoom`, `send`, `playAction`, `leaveRoom`, `SERVER_URL` | Thin colyseus.js wrapper; funnels every message into the store. Rejoin-by-`playerId` with backoff, since the server restores seats by id. |
| `src/net/deviceId.ts` | ✅ | `getDeviceId`, `getDisplayName`, `setDisplayName` | AsyncStorage-persisted device identity. No accounts in v1. |
| `app/_layout.tsx` | ✅ | — | Holds the splash until the CJK font loads — every tile glyph uses it. |
| `app/index.tsx` · `lobby.tsx` · `table.tsx` · `results.tsx` · `join/[code].tsx` | ✅ | — | The four screens plus the `mahjong://join/CODE` deep link. |
| `app/dev-gallery.tsx` | ✅ | — | All 42 faces at every size, plus melds. **This is the screen the art gets judged on** — geometry tests prove dots do not overlap, but only an eye can say whether 22px 九萬 is legible. |

**Testing note (hard-won):** all component tests live in ONE file and never call
`unmount()`, and every `fireEvent` is awaited. RNTL 14's `fireEvent` is async
(un-awaited it corrupts the renderer via overlapping `act()`), and its renderer
root leaks across test *files* in a reused Jest worker. Both faults present as
tests that pass alone and fail in a full run.

Screens, from the spec:

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
