# Changelog

All notable changes to this project are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.2.3.1] - 2026-08-17

### Fixed

- **You could not count a side opponent's tiles.** Their hand rendered as an
  unbroken column of seventeen identical 4px bars — which is exactly the thing
  an eye cannot count, and knowing someone is down to 13 changes how you play
  against them. The slivers are now grouped in fours, so you read the column as
  a tally (4, 8, 12, 16, remainder) instead of counting bars one at a time, and
  each one carries a strip of the tile's ivory body beneath its green back —
  the way a face-down tile actually looks from the side. The count also appears
  as a plain number next to the name, because it costs nothing and settles it.

  Thin is still forced: a vertical stack of 17 tiles at any recognisable tile
  size needs ~186px of a ~144px band. Grouping is what was missing, not size.

### Added

- Render tests for the grouping rule: one sliver per concealed tile, breaks
  every four, and never a trailing break off the end — a stray gap under the
  stack reads as one extra tile. Both new guards were checked by breaking the
  code and confirming they fail.

## [0.2.3.0] - 2026-08-17

A second end-to-end walkthrough at 880x400, screen by screen, watching each one.
The table itself held up — the previous pass fixed that. Everything *around* it
did not: two screens clipped their primary button off the bottom, one hid the
winner of the session, and the table silently swallowed the single most
important thing you can learn about an opponent.

### Fixed

- **The results screen hid who won.** Stacked vertically it needs ~470px; the
  screen is ~400. First place was clipped off the top, "Play again" was sliced in
  half, and "Leave table" was off-screen entirely with no way to reach it. Now
  two columns — standings beside the actions — like Home and the lobby.
- **Opponents' exposed melds were invisible.** An opponent's melds and flowers
  were stacked *below* their tile backs, which took the top seat's panel to 80px
  inside a 56px zone with `overflow: hidden`. Someone could pung the tile you
  just threw and no meld would be drawn. A revealed pung is the strongest read
  you get on what a player is collecting, so this was the worst thing the panel
  could do. Exposed tiles now sit beside the concealed ones — along the name row
  across the table, alongside the sliver stack at the sides — which is also
  where melds are laid on a real table.
- **No screen shows a navigation header any more.** 64px of chrome is 18% of a
  landscape phone, spent on a back arrow for screens that already have their own
  title and their own "Leave table".
- **A refused join blamed your wifi for everything.** Tapping an invite to a
  table that had filled up said "Check your connection and try again". There are
  three cases and they need opposite responses, so there are now three messages:
  no such code, table full (ask them to remove a bot), and a genuine transport
  failure. The server carries a dedicated `JOIN_ERROR` code for the full case
  rather than making the client match on English prose.
- **The deep-link failure screen's button said "Join table" and went Home.** It
  now says "Enter a code", which is where it goes.
- The emote layer's hardcoded `top: 56` was a stale copy of the top zone's
  height, and went wrong the moment that zone changed. It reads the token.

### Added

- Layout budgets for the menu screens, not just the table — and each asserts
  *both* directions: the taller column fits, and the stacked version does not.
  Without the second half they pass no matter what the numbers are, which is
  exactly how the first `layoutBudget.test.ts` went green while the table was
  unplayable. The header test likewise proves a 64px bar would still break the
  lobby, so `headerShown: false` is demonstrably load-bearing rather than taste.
- `classifyJoinFailure` with tests built on the real `colyseus.js` error classes,
  and server tests that pin each rejection code against a running server — a full
  table of humans, a table full of bots, and an unknown code all reach the client
  differently, and all three are now verified rather than assumed.

### Verified by eye at 880x400

Home, lobby, table, claim window (碰 offered on a real discard, opponent ringed
in gold, exposed melds and flowers legible), hand-result overlay with its tai
breakdown and zero-sum payments, session standings, both join-failure screens,
and all 42 tile faces. The 條 fix from v0.2.1.0 was re-checked at 2.6x zoom:
every bamboo renders as elongated capsules, unmistakable from the 筒 rings
directly above them.

## [0.2.2.0] - 2026-08-17

The landscape table now actually fits a phone.

v0.2.1.0's visual pass was done in a **1100×900 desktop browser window**, which
is not the target. A phone in landscape is about **880×400 CSS pixels** — less
than half the height. Re-tested at that viewport, the table did not merely look
sparse: every zone rendered on top of every other. The opponent across the table
covered the wind indicator, the left seat's tiles ran under the hand, and the
discard ponds sat on top of the player's own tiles.

### Fixed

- **The table is laid out in fixed-height zones** instead of letting each band
  size itself. Top 56px, bottom 152px, middle takes the rest. Nothing can push
  into anything else.
- **Tiles are sized for the real screen.** The hand tile drops 44→36px (49px
  tall), and discard/meld/mini shrink with it. Width was never the constraint —
  17 hand tiles span ~630px of the 880 available; height was.
- **Side opponents render their concealed tiles EDGE-ON**, as thin slivers.
  That is both what you actually see from someone's left or right and the only
  way 17 tiles fit: as full backs they stack ~186px deep in a ~152px band,
  which is precisely what drove the side panels through the middle of the table.
- **The top opponent's tiles stay on one row.** Wrapping to a second row
  overflowed the zone and got clipped, leaving their tile count — the one thing
  that panel exists to show — unreadable.

### Added

- `test/layoutBudget.test.ts` — the height budget as arithmetic a test can
  check: zones leave room for the middle, hand + melds + actions fit the bottom,
  a 17-tile hand fits the width, ponds fit side by side, touch targets stay
  ≥44px. The side-opponent test also asserts that full tile backs would *not*
  fit, so it cannot quietly stop being load-bearing.

## [0.2.1.0] - 2026-08-17

The app was run and played for the first time — on Expo web, against a live
server, with three bots. That found five real bugs that no unit test had caught,
because every one of them was about what you *see*.

### Fixed

- **條 tiles rendered as dots.** The bamboo node was drawn as an opaque ellipse
  1.4× the stick's width, which severed each 索 into two stubs and made 九條
  read as 九筒. Sticks are now proper capsules (aspect 2.7–3.6) with hairline
  node ticks, and stick length is derived per layout so rows cannot collide.
- **Face-down tiles were invisible on the table.** `tileBack` scored **1.23:1**
  against `tableFelt` — an opponent's 16 concealed tiles rendered as one green
  smear you could not count, and counting an opponent's hand is part of
  playing. Now 2.97:1 against the felt and 2.31:1 from the tile face.
- **Opponent panels overflowed and their names were upside-down.** Rotating the
  whole panel made layout reserve the unrotated box, so tile blocks spilled
  across the table. Panels are no longer rotated; tile-backs are arranged to
  suit their edge and names stay upright.
- **Discard ponds collapsed to a one-tile-wide scrolling column.** A wrapping
  row has zero intrinsic width in React Native, so `maxWidth` alone wrapped
  after every tile. The pond now has an explicit width, and the four ponds sit
  side by side instead of in a scroll view.
- **Unhandled rejection from `ScreenOrientation.lockAsync`** on platforms
  without orientation lock. Now swallowed — the table plays fine either way.

### Added

- `src/theme/contrast.ts` and `test/contrast.test.ts` — WCAG contrast ratios for
  theme colours, so "you can see it" is a rule a test enforces rather than an
  opinion. Covers tile back vs felt, back vs face, ink on tiles, text on felt,
  and the gold accent on every surface it is used on.
- Bamboo geometry tests: a stick must be at least `MIN_STICK_ASPECT` times
  taller than wide, sticks must not overlap, and node markings must be narrower
  and thinner than the stick they decorate.

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
