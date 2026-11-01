# Changelog

All notable changes to this project are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.3.0.0] - 2026-11-01

### Added

- **Hong Kong (Cantonese) rules.** The host picks the ruleset in the lobby
  before the deal: Taiwanese (16 tiles, 台) or Hong Kong (13 tiles, 番). Hong
  Kong brings its own 番 table — 平糊 1 · 對對糊 3 · 混一色 3 · 七對子 5 · 小三元 5 ·
  小四喜 6 · 清一色 7 · 大三元 8, the dragon/wind/flower/winning-condition extras,
  and limit hands 字一色 · 坎坎糊 · 清么九 · 九子連環 (10) and 大四喜 · 十八羅漢 ·
  十三么 · 天糊 · 地糊 (13) — and four house options: minimum to win (Any, 1, 3,
  5), maximum (10 or 13), half- or full-spicy payment, and seven pairs on or
  off. Defaults: 3, 13, half spicy, on. A hand under the minimum is never
  offered as a win. The score sheet counts 番. Spec:
  `docs/superpowers/specs/2026-11-01-hong-kong-variant.md`.
- Bots play Hong Kong hands too (standard shapes; see TODOS on playing for 番).

### Changed

- The engine's `Variant` now owns everything a ruleset decides about a win —
  shape, minimum, score, payment — and every path to a win goes through one
  check, so Taiwanese and Hong Kong share all table mechanics.

## [0.2.17.0] - 2026-11-01

### Changed

- **Claim buttons are coloured.** 吃, 碰 and 槓 share a blue no other surface
  uses, so an offer stands out from Pass beside it; **胡 gets its own look** —
  the red lacquer and gold rim of the 胡 stamp, with cream lettering. Discard
  stays gold. Contrast tests keep each label readable and each colour tellable
  from its neighbours. `/dev-gallery` shows the whole row.

## [0.2.16.0] - 2026-11-01

### Changed

- **The "N left" counter counts only tiles that can still be drawn.** The last
  16 tiles of the wall are a reserve that is never drawn, so the counter used
  to stop at 16 and showed "16 left" beside a drawn hand. It now counts down to
  0 exactly when the wall runs out.

## [0.2.15.0] - 2026-11-01

### Fixed

- A drawn hand's 流局 stamp was buried by the result sheet a third of a second
  after it appeared — only wins made the sheet wait. Every ending now gets its
  stamp's full beat (`resultSheetDelay`).

## [0.2.14.0] - 2026-11-01

### Changed

- **Every discard pond fills left to right, top to bottom**, whatever the seat.
  Ponds used to start nearest the middle and run in each owner's own direction
  (right to left for the player across, down or up the screen for the sides);
  where a pond sits already says whose it is, so the order inside it now reads
  like a line of text.

## [0.2.13.0] - 2026-10-31

### Added

- **Thinking dots.** Three gold dots rise and fall by the name of the
  opponent whose turn it is, so a bot's pause reads as thinking rather than as
  the game having stalled. Claim windows show none.

## [0.2.12.0] - 2026-10-31

### Changed

- **The action buttons sit right above your hand, side by side.** They share
  the row above your tiles with your melds — melds on the left, buttons on the
  right — instead of stacking up a column down the right of the screen. Pass is
  on the far left, away from the thumb; 胡 and Discard on the far right, under
  it. If the buttons nearly fit they step down a size; only if they still do
  not fit does a second row rise over the felt, over your own discards, for the
  seconds a claim window is open. Smaller buttons keep a full 44px touch area.
- **Chow buttons show the run they make as tiles** — its two tiles and the one
  being claimed — instead of codes like "2w 4w". A kong button shows its tile.
- **The hand takes the full width and grows to 42px tiles.** The 100px gutter
  the button column needed is gone, so an 800px phone no longer shrinks the
  hand at all.

## [0.2.11.0] - 2026-10-31

### Changed

- **Each player's discards lie in front of them.** Mine along the bottom of
  the felt, the player across along the top, the side players' at the ends —
  where they sit, not in an anonymous strip of four across the middle. Each
  pond starts nearest the centre and grows toward its owner, reading in the
  owner's own left-to-right, as at a real table. Each sits on its own mat,
  watermarked with the seat's wind (東 is the dealer), so the four read as four
  places from the first turn. Only the newest discard at the table is ringed:
  the one that can still be claimed. The duplicate copy of it that sat in the
  middle is gone.
- **Discards size themselves to the felt.** The layout picks the largest tile
  at which every pond holds 18 — the most any seat threw across 3000 simulated
  hands — so a small phone gets 21px discards and an 880×400 one gets 27px,
  instead of a fixed 24px that overflowed one and wasted the other. A pond past
  18 squeezes together rather than spilling off its mat.
- **The hand is bigger: 40px tiles, up from 36.** My melds grow to 30px.

### Fixed

- On an 800px-wide phone the last tiles of the hand sat under the Discard
  button, which took their taps. The hand was sized to the width beside the
  action stack but centred across the whole screen; it is now laid out beside
  it.
- Late in a hand, the old pond strip could outgrow the middle of the table and
  be clipped without a trace on smaller phones.

## [0.2.10.0] - 2026-10-31

### Added

- **The table moves.** The opening deal cascades in across all four seats; a
  drawn tile drops into its place while the rest of the hand glides aside; a
  discard lands in the pond from the thrower's side of the table; a claimed
  meld rises into place tile by tile; whoever is on turn gets a slow breathing
  gold ring. A selected tile rises on a spring with a gold halo, and a pressed
  tile dips like a key. Every motion snaps to rest under the OS's
  reduced-motion setting.
- **Call-outs.** 碰, 槓, 吃, 花, 胡, 自摸 and 流局 are stamped in front of whoever
  made the call, as a red-lacquer seal with a gold ripple. A win is centred and
  larger, throws sparks and dims the table for a beat, and the result sheet now
  waits for it to lift instead of covering it.
- `/dev-gallery` opens with a motion stage: a button per effect, so each can
  be replayed and judged without playing a hand.
- `tableEvents` (what changed between two views), `planMotion` (what should
  move) and `motion.ts` (every spring and duration), each with tests driven by
  real engine play.

### Changed

- **Tiles look like tiles, not miniatures.** The art is shown through a box
  cropped to the drawing (it carried ~15% blank margin), the corner radius is
  11% of the tile instead of a fixed 7px, and the bottom edge now shows the
  tile's thickness: an ivory band over the green back.
- With two of a kind in hand, only the tile you tapped lifts.

### Fixed

- A call-out under reduced motion vanished the instant it appeared: Reanimated
  skips delays to their end under that setting, so the hold-then-fade now runs
  in full regardless.

## [0.2.9.0] - 2026-10-31

### Changed

- **Tiles are drawn with real artwork.** All 42 faces now come from samoheen's
  Taiwan set, a public-domain (CC0) set drawn for Taiwanese mahjong: bold block
  lettering, flowers 梅蘭菊竹 and seasons 春夏秋冬 with their own drawings, and a
  bird on 一條. It was picked over a dozen other sets because it is the only one
  that is free of license conditions AND complete for Taiwanese play; the
  well-drawn alternatives are Japanese sets with no flower tiles.
- `TileFace` renders a face's SVG through `SvgXml` instead of drawing circles,
  sticks and font glyphs from coordinates.

### Added

- `assets/tiles/taiwan/`, the 42 source SVGs exactly as published, with their
  license. `scripts/build-tile-art.mjs` turns them into
  `src/tiles/art/taiwan.generated.ts`, keyed by engine tile code.
- `test/tileArt.test.ts`: every tile has a face, each carries the face drawn for
  it (checked against the artist's own title, so a mis-mapped file fails), and
  no face uses masks, `<use>` or ids, where renderers disagree.

### Removed

- `src/tiles/tileData.ts` and its tests — the faces described as data were the
  stand-in until real art arrived.

## [0.2.8.0] - 2026-08-18

### Changed

- **The left and right players' tiles are laid DOWN, and nothing overlaps.**
  Those players' tiles face them, so from your seat they are turned ninety
  degrees; drawing them upright was drawing them from your own point of view
  rather than theirs. The seat across the table still stands upright, because
  their tiles really do face you.

  Laying them down is also what removed the overlap. An upright mini tile is
  24.5px, and nine of them never fit the rail — every previous version hid part
  of each tile behind the next to cope. Laid down the same tile is 13px, so two
  columns of nine come to 133px in a 142px budget and **every tile is drawn
  whole, with felt around it**.
- `Tile` gains a `landscape` prop. Only face-down backs use it, which have no
  glyph that would have to rotate with them.

### Added

- A render test that a side seat's tiles come out wider than tall. The obvious
  version of this test — comparing the tokens — passed whether the component
  laid the tiles down or not; this one reads the box that actually got drawn,
  and was confirmed to fail when the `landscape` prop is removed.
- A render test that no tile carries a negative margin, i.e. that the stack has
  not quietly gone back to overlapping.

## [0.2.7.0] - 2026-08-18

### Changed

- **A side player's tiles are dealt into two columns instead of one.** Stacked
  in a single column, 17 tiles could only afford an 11px step — under a quarter
  of each tile — and however they were drawn the result looked cramped. Split
  across two columns the tallest runs to 9, which halves the height and buys
  back the room: **just under half of every tile now shows** instead of a
  quarter.
- The group break grew from 3px to 6px to keep pace. At the old step a 3px
  break marked a group; at this one it had stopped being visible as anything.
- The rim widens 100 -> 112 to hold the second column.

### Fixed

- The height budget did not count the 1px top edge each tile draws, which is a
  border and so adds to its box. Over a 9-tile column that was 9px unaccounted
  for, leaving 2px of rail margin where the arithmetic claimed 8. The budget
  counts it now, and the step was trimmed to restore the margin.

## [0.2.6.0] - 2026-08-17

### Changed

- **The left and right players hold real tiles now, not slivers.** They are the
  same `mini` tile backs the seat across the table uses; they simply overlap
  down a column, the way a fanned hand of cards does, so you see the near tile
  whole and the top edge of every one behind it.

  Overlapping is not a compromise, it is the only arrangement that fits: 17 mini
  tiles laid out clear of one another are 434px tall. Every previous attempt
  drew an abstract bar instead — 4px, then 6px with a rounded end — and each one
  still read as a slit rather than a tile.

  Two things had to be found to make it work. The **side seats moved onto
  full-height rails** rather than being confined to the middle band: that band
  is capped by the top seat's zone, but that zone is centred across the table
  and its corners were dead space. And each tile needed **a line along its top
  edge** — green backs overlapping green backs draw one solid column, with every
  tile present and nothing showing where one ends and the next begins.
- The rim narrowed from 112px to 100px, since a stack of tile backs is 18px wide
  where the old bar was 34. That width goes back to the playing surface.

### Added

- A second opponent-panel sample in `/dev-gallery`: a full concealed hand
  alongside the heavily-exposed one. They stress opposite dimensions — a full
  hand is the tallest the stack ever gets, a melded one the largest the exposed
  grid gets, and a player never has both at once.
- A render test that the stack really overlaps (every tile's top margin stays
  negative), and a budget test asserting the un-overlapped layout would *not*
  fit — so if the overlap ever stops being load-bearing, the test says so
  instead of quietly passing.

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
