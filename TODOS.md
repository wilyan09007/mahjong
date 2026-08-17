# TODOS

Open work, grouped by component then priority (P0 highest through P4).
Completed items move to the bottom with the version that shipped them.

## Blocked on you (nothing here can be done from a shell)

### Run the app on a device — every visual checkpoint in Plan 3
**Priority:** P0
`@mahjong/app` is fully written and unit-tested (71 tests) but **has never been
launched**. No emulator or device exists in the environment it was built in, so
the layout and art are proved *correct*, not proved *good*. Outstanding:

- `pnpm -F @mahjong/app start`, press `a` — does it boot at all?
- `/dev-gallery` — are all 42 faces legible at 44px and at 22px? The geometry
  tests guarantee dots do not overlap and glyphs are non-empty; only an eye can
  judge whether 九萬 reads at mini size. Expect to tune `tileData.ts`
  coordinates and `tokens.ts` values — that is what they are for.
- A full hand, 1 human + 3 bots, in landscape: do claims, kongs, the timer, the
  results overlay and the emotes all read correctly?
- Two devices over LAN (`EXPO_PUBLIC_SERVER_URL` = your PC's LAN IP) — the v1
  experience test.
- Deep link: `npx uri-scheme open "mahjong://join/ABCDEF" --android`.

### Ship it — Plan 4
**Priority:** P0
See `docs/DEPLOYMENT.md` for the ordered runbook. Every artifact exists
(Dockerfile, fly.toml, eas.json, privacy policy, full listing copy with every
console declaration pre-answered). What is blocked: Fly account + payment,
Expo account, EAS builds, the $25 Play registration, the console forms, and the
14-day closed-testing soak.

### App icon, splash, and store graphics
**Priority:** P1
`icon.png` 1024², `adaptive-icon.png`, `splash.png`, `store/icon.png` 512²,
`store/feature-graphic.png` 1024×500, and 4 landscape screenshots. Cheapest
source is `/dev-gallery` on a device — screenshot the 中 tile on felt and crop.
Blocked on the device work above.

### Verify the Docker image builds
**Priority:** P1
`packages/server/Dockerfile` is written but never built — Docker Desktop was
installed here but not running. The server *was* verified booting exactly as the
image's `CMD` runs it, serving `/health`, and accepting a real WebSocket client
that created a room. Only the image layer is unproven.
`docker build -t mahjong-server -f packages/server/Dockerfile .`

## Roadmap

### Plan 3 Task 9 — animation and polish pass
**Priority:** P2
Reanimated is installed and configured but **no animations are implemented**.
Deal-in stagger, draw slide-in, discard flight to the pond, claim pulse, win
overlay flip-up, turn-indicator easing. Deliberately deferred: animation is
tuned against a running app, and there was none to tune against. The spec's bar
is "polish is rendering + motion", so this is real remaining v1 scope, not gold
plating.

### v1.1 — Cantonese variant
**Priority:** P4
`VARIANTS` has the seam and `resolveVariant` throws for `'cantonese'` today.
Needs a 13-tile hand size, its own scoring module and its own test table.

### v1.2 — cosmetics store, rewarded ads, iOS
**Priority:** P4
Per the spec's phasing. Each starts with its own brainstorm → spec → plan cycle.

## packages/engine

### House rules beyond stakes are not modelled
**Priority:** P3
`HandRules` carries only `base` and `perTai`. The room lobby also sets
`totalRounds` and timers (server-side, correctly — no clock may enter the
engine), but any rule that changes *legality* — whether a discard may be robbed,
table-specific tai values — needs a home in `HandRules` or the `Variant`.

## packages/server

### Colyseus core is pinned to 0.16.24 by a root pnpm override
**Priority:** P3
`@colyseus/core@0.16.25` ships a broken manifest — it depends on
`@colyseus/greeting-banner@workspace:^`, a workspace protocol that leaked into a
published package, and pnpm refuses to install it. The override in the root
`package.json` pins 0.16.24. Remove it once upstream fixes the release.

Related: the whole stack is held on the Colyseus **0.16** line because the
client `colyseus.js` has no 0.17 release. Revisit together when it does.

## packages/app

### Component tests are fragile by toolchain, not by design
**Priority:** P3
All component tests live in ONE file, never call `unmount()`, and always await
`fireEvent`. RNTL 14's `fireEvent` is async (un-awaited it produces overlapping
`act()` scopes that corrupt the renderer), and its renderer root leaks across
test *files* in a reused Jest worker. Both faults present as tests that pass
alone and fail in a full run. Re-check on the next RNTL/React major.

### pnpm is in hoisted mode for the whole workspace
**Priority:** P4
`.npmrc` sets `node-linker=hoisted` because React Native's tooling resolves a
long tail of transitive packages it never declares. It costs pnpm's strictness
repo-wide: an undeclared dependency now resolves instead of erroring.

## Completed

- **Plan 1 — monorepo scaffold + Taiwanese rules engine.** All 12 tasks.
  **Completed:** v0.1.0.0 (2026-08-17)
- **Plan 2 — authoritative server + bots.** All 10 tasks: `viewFor`, shanten,
  bot policy, rooms with join codes, game flow, bot seats, timers, disconnect
  cover, sessions, multi-room soak.
  **Completed:** v0.2.0.0 (2026-08-17)
- **Plan 3 — Expo client (code).** 42-face tile art, four screens, store,
  connection, deep links. Device verification outstanding (see P0 above).
  **Completed:** v0.2.0.0 (2026-08-17)
- **Plan 4 — delivery artifacts.** Dockerfile, fly.toml, eas.json, privacy
  policy, store listing with all console answers, deployment runbook. Account
  and console work outstanding (see P0 above).
  **Completed:** v0.2.0.0 (2026-08-17)
