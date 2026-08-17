# Changelog

All notable changes to this project are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.2.0.0] - 2026-08-17

Plans 2, 3 and 4. You can now run a real server, have friends join a private
table with a six-character code, fill empty seats with a competent AI, play
complete scored sessions, and drop and rejoin without the table waiting for you.
The Expo client is written and unit-tested but has not yet been run on a device.

### Added

- **`@mahjong/server`** — authoritative Colyseus room server. The join code *is*
  the room id, so a friend joins with nothing but the six characters off your
  screen. Codes come from a 32-character alphabet with I, O, 0 and 1 removed —
  the pairs people misread when a code is read aloud or typed off a photo — and
  are reserved against a presence set so two live rooms can never share one.
- **Hidden information never reaches a client.** `viewFor` is the single choke
  point between engine state and the wire, and `OpponentView` has no `hand`
  field at all — not optional, absent — so no server-side mistake can populate
  one. Every server test that observes a message checks this across the whole
  message history, not just the latest.
- **`@mahjong/bot`** — shanten-minimising AI. 181 wins in 200 bot-vs-bot hands;
  uniformly random play won zero of 200. It sees only a `PlayerView`, exactly
  what a human client receives, which is what makes it honest cover for a
  disconnected player rather than a cheat.
- **Nobody can stall the table.** Bots move after a think-delay; a silent human
  is played for on their own turn and passed in a claim window (rather than made
  to claim something they never chose); a disconnected player keeps their seat,
  is covered immediately, and reclaims it by rejoining with the same id.
- **Multi-hand sessions** with running scores, standings, and play-again. Scores
  are always zero-sum — points move between players and are never created.
- **`@mahjong/app`** — Expo client: 42 original tile faces, Home, Lobby,
  landscape Table and Results screens, emotes, share-sheet invites, and
  `mahjong://join/CODE` deep links.
- **Tile art as data.** Faces are coordinates and colour token names rather than
  42 SVG files, so a future theme is a data swap — and so the set is verifiable.
  The tests assert the five-dot tile really has five dots and that no two dots
  overlap, which caught a real bug: the nine-dot face would have rendered as
  overlapping blobs on every 9筒 in the game.
- **Delivery artifacts** — Dockerfile, `fly.toml`, EAS build profiles, privacy
  policy, and store listing copy with every Play Console declaration
  pre-answered. Ordered runbook in `docs/DEPLOYMENT.md`.

### Changed

- `SessionParams` gains an explicit `roundsCompleted` lap counter, and
  `isSessionOver` now accepts 1–4 rounds instead of throwing for 4. The round
  wind cannot count laps — it wraps N→E, so four completed rounds read
  identically to a fresh session — and a 4-round game (全莊) is the standard
  Taiwanese format the lobby offers.

### Known limits

- **The app has never been launched.** No emulator or device was available where
  it was built, so every visual checkpoint in Plan 3 is outstanding and no
  animations are implemented yet. The layout and art are proved correct, not
  proved good-looking. See `TODOS.md`.
- **Nothing is deployed.** Fly.io, Expo and Play Console steps all need your
  accounts and payment methods.
- The Docker image has not been built (Docker Desktop was installed but not
  running), though the server was verified booting exactly as the image's
  command starts it, serving `/health`, and accepting a real WebSocket client.

## [0.1.0.0] - 2026-08-17

First working code in the repo. You can now play complete, correctly scored
Taiwanese mahjong hands from a seed — everything a server or a bot needs to run
a game, with no UI and no network involved.

### Added

- **`@mahjong/engine`** — the complete Taiwanese 16-tile rules engine as a pure
  state machine. Three functions are the whole contract: `newHand`,
  `legalActions`, `applyAction`. Zero runtime dependencies, so it drops into a
  Node server and a React Native bundle unchanged.
- **Deterministic hands.** A hand is fully reproducible from its seed: the same
  seed and the same actions always give the same result, so a bug reported as
  "seed 8231, step 47" replays exactly instead of being chased.
- **The full rule set** — the 144-tile wall, the opening deal with flower
  exposure and dead-wall replacement, turn flow, the claim window with
  win > kong = pung > chow priority, chow-from-the-left, concealed and added
  kongs with replacement draws, robbing the kong (搶槓), and the exhaustive
  draw at the 16-tile wall floor.
- **Taiwanese scoring**, all 22 tai rows with suppression handled — 大三元/小三元
  replace 三元牌, 大四喜/小四喜 replace the wind tai, 五暗刻 replaces 四暗刻.
  Values verified against a published 台灣十六張麻將台數表. Scoring evaluates
  every valid reading of the hand and pays the best one, because the same tiles
  are often two hands at once and only one earns 碰碰胡.
- **Payments** that always sum to zero, with the dealer bonus (連N拉N =
  `1 + 2 * streak`) applied to any payment the dealer is on either end of.
  Stakes are parameters — 3底1台 by default, never hardcoded.
- **Session bookkeeping** — dealer repeats on a win or an exhaustive draw, the
  deal passes otherwise, and the round wind advances E→S→W→N on each full lap.
- **A variant seam** for Cantonese (v1.1). `GameState` stores a `variantId` and
  resolves it through a registry, never a function reference, so the whole
  state stays plain JSON: cloneable in-process and serialisable straight down a
  socket.
- **Diagnostics for a pure engine.** `formatState` dumps everything a bug report
  needs, `traceAction` says what an action actually changed, `traceHand` returns
  a whole hand's transcript, and `checkInvariants` verifies exact tile
  conservation, hand shapes, meld well-formedness, phase consistency and
  zero-sum payments. Every renderer returns a string and prints nothing, so the
  engine stays I/O-free.
- **183 tests, no mocks anywhere.** Unit coverage per module, one test per tai
  row, and two 200-hand property simulations — uniform-random to explore the
  state space, greedy to actually reach wins and exercise scoring end to end.
  Both check every invariant at every step and fail with the seed, the step,
  the last 40 actions and a full state dump.
- **Purity is enforced, not just documented.** A test scans the source tree and
  fails on `Math.random`, any clock, `console`, `process`, Node builtins or
  timers in `src/`, and rejects test doubles or skipped tests anywhere in the
  suite.
- **Monorepo scaffold** — pnpm workspaces, strict TypeScript with
  `noUncheckedIndexedAccess`, Vitest, and root `test` / `typecheck` scripts.

### Known limits

- `isSessionOver` accepts 1–3 rounds. A 4-round 全莊 session needs an explicit
  lap counter on `SessionParams`, which is deliberately left for Plan 2's room
  configuration rather than changing a shape Plan 1's contract pins down. It
  throws and names the fix instead of ending a session at the wrong time.
- `packages/server`, `packages/bot` and `packages/app` do not exist yet. Plans
  2–4 have not been written.
