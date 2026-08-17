# TODOS

Open work, grouped by component then priority (P0 highest through P4).
Completed items move to the bottom with the version that shipped them.

## Blocked on you (nothing here can be done from a shell)

### Run the app on a real Android device
**Priority:** P0
The app has been run and played **on Expo web at 880x400** (phone landscape),
which found and fixed fifteen real bugs — see the v0.2.1.0 through v0.2.3.0
changelogs. Every screen has now been inspected at that size, and a complete
8-hand session played from create-table to standings. **Always test at that
viewport**: the first pass used a 1100x900 desktop window, where the table
looked fine but was unusable on a phone; the second fixed the table and left the
menu screens clipping their primary buttons off the bottom.

What web still cannot tell you: touch accuracy with a thumb, whether landscape
lock behaves, real frame rates, and how the palette looks on a phone screen
rather than a monitor. Still outstanding:

- `pnpm -F @mahjong/app start`, press `a` on an emulator or device.
- `/dev-gallery` on a phone — is 22px 九萬 legible in the hand?
- A full hand in landscape: claims, kongs, timers, results overlay, emotes.
- Two devices over LAN (`EXPO_PUBLIC_SERVER_URL` = your PC LAN IP).
- Deep link: `npx uri-scheme open mahjong://join/ABCDEF --android`.

**To run it on web again** (fastest feedback loop, no emulator needed):
```bash
pnpm dev:server                                   # game server on :2567
cd packages/app
EXPO_PUBLIC_SERVER_URL=http://localhost:2567 npx expo start --web --port 8090
```

### Discard ponds are not placed by seat
**Priority:** P2
All four ponds sit in a row in the middle of the table rather than adjacent to
each player edge, so you cannot tell at a glance who threw what. Plan 3 Task 7
asks for per-edge placement. The ponds themselves render correctly.

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
