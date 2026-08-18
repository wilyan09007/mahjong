# Changelog

All notable changes to this project are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.2.5.1] - 2026-08-17

### Changed

- **A side player's concealed tiles are plain backs again.** Each sliver had
  been given a strip of ivory body along its bottom edge to look more tile-like;
  tiles pushed flush together do not show their bodies that way, and the result
  read as a stack of stripes. Counting is handled by the grouping in fours and
  the printed count, which is what was doing the work anyway.
- **A side player's completed sets are drawn at `mini` again, not `micro`.** The
  13px size was small enough to be unreadable, which defeats the point of
  showing an exposed meld at all. `micro` is deleted from the tile sizes
  outright. The rim widened from 96px to 112px to hold three `mini` tiles beside
  the stack — width well spent, since a revealed meld is the strongest read you
  get on another player. Discard ponds are unaffected at the 880px target.

### Added

- **Opponent panels in `/dev-gallery`**, for all three edges, loaded with four
  melds and four flowers. Judging these in a live game means waiting for a bot
  to claim before a single meld appears on the rim; now they can be looked at on
  demand, at exactly the width the table gives them.
- A budget test for the rim: a side panel's stack plus three exposed tiles must
  fit `TABLE_ZONES.side`, and `mini` must stay big enough to identify — the two
  failures that produced the last two versions, one in each direction.

## [0.2.5.0] - 2026-08-17

A placement pass over the whole table, done by measuring every component's
rectangle rather than looking at it. Three of the five problems below were
invisible in a screenshot and obvious in the numbers.

### Fixed

- **A side player's exposed melds ran off the screen.** The right seat's melds
  reached 31px past the right edge; the left seat's spilled 80px out across the
  playing surface. Same React Native trap as the discard ponds: a meld is a
  non-wrapping row, and a non-wrapping row inside a `maxWidth` box does not
  shrink, it overflows. Side seats now draw their exposed tiles as a grid with
  an EXPLICIT width, at a new `micro` size, so four melds and their flowers fit
  the rim. The flattening keeps the concealed-kong rule — two of an 暗槓's four
  tiles stay face down — and that rule is now a pure function with a test,
  because asserting it through the rendered SVG silently proved nothing.
- **The action stack sat on the right player's tile count**, clipping the panel
  corner by 60×8px — the last of the very slivers that panel exists to let you
  count. It now stops above the emote row.
- **The Discard button covered the right end of your own hand** on a narrow
  window: 17 tiles at full size take 91% of 711px, leaving no room beside it.
  The hand is sized to what is actually free beside the action gutter, never
  larger than before, so nothing changes on the 880px target.
- **The status block was anchored to the playing surface, not the screen.**
- Seats and melds crossed the surface's rounded edge by 3–4px, which read as
  the felt being torn rather than tiles resting on a table. The surface is inset
  clear of every zone now.

### Changed

- **A side player's exposed tiles are mirrored** so they always lie on the
  table side of their concealed stack, never the screen side. Un-mirrored, the
  right seat's melds were shoved against the bezel while the left seat's sat
  neatly inboard.
- **"Your turn" is gold and bold.** Every opponent gets a gold border on their
  turn; moving the status to a corner had left your own turn — the one cue that
  decides whether you act — as the quietest thing on the table.
- The emote row gets 8px of floor clearance instead of 4, and the status block
  is inset to match the screen's own padding rather than jammed against the
  bezel.

## [0.2.4.1] - 2026-08-17

### Changed

- **The round wind and wall count moved out of the middle of the table** and
  into the corner of the playing surface. They sat exactly where your eye goes
  to read the ponds; a scoreboard belongs at the edge, the way the indicator
  does on a real table. The tile just thrown stays in the middle, where it
  landed.
- **Completed sets sit directly above your remaining tiles**, in the space the
  action bar left behind — they are part of the hand you are reading, so they
  belong beside it rather than in a corner.
- **The bottom-left corner is flowers only.** Flowers are scoring bookkeeping
  rather than part of the hand, so they are the one thing that can live away
  from the tiles.

## [0.2.4.0] - 2026-08-17

The table now looks like a table, and the controls stopped fighting each other.

### Fixed

- **Face-down tiles had their bottoms bitten off.** The depth strip under a
  face-down tile was drawn in near-black felt, so every tile in the hand across
  the table wore a dark band that read as a shadow eating it. That strip is
  ivory now whichever way the tile faces, because a mahjong tile's *body* is
  ivory and only its back is coloured — the edge turned toward you is the lit
  one, not the dark one.
- **The newest discard jumped up behind the row above it** and was clipped in
  half. It inherited the hand's "lift" — the right signal for *the tile you are
  about to throw*, wrong for *the tile that was just thrown*. The ring stays,
  the lift does not.
- **The discard ponds shoved into the side players.** Four ponds at a fixed six
  tiles a row are wider than a narrow screen, so the row wrapped into a 2×2
  block that swelled across the middle of the table. Columns now adapt to the
  width so all four stay side by side, verified from 800px to 1100px.
- **The action bar and the emote row shared a line and overlapped.**

### Changed

- **The table has depth.** The screen is now the rim all four players sit at,
  with the playing surface inset a shade lighter and softly rounded — the wall
  and the ponds rest on it, the seats fall outside it. Deliberately subtle: a
  contrast test holds the two felts between 1.08:1 and 1.6:1, close enough to
  read as one table lit unevenly rather than a green box on a green screen.
- **Your melds and flowers moved into the empty band under your hand**, in the
  bottom-left corner, sharing that strip with the emotes on the right. Above
  the hand they competed with the tiles you are actually choosing between.
- **The claim buttons (吃/碰/槓/胡) stack up the right-hand side**, directly
  above your hand, instead of sitting centred beneath it. The column is bounded
  by the two fixed zones and wraps into a second column rather than ever
  running off the top of the screen.

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
