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

### Animation — what is left after the first pass
**Priority:** P3
The first motion pass shipped in v0.2.10.0: deal cascade, draw drop-in, discard
landing from the thrower's side, meld lay-down, selection lift and halo, press
dip, turn glow, call-out stamps (碰 槓 吃 花 胡 自摸 流局), and the result sheet
waiting for the win. Replay any of it from `/dev-gallery`. Still open:
- **Frame rate on a real phone.** Only judged on Expo web. A table holds ~140
  tiles; if a mid-range Android drops frames during the deal, stagger fewer
  tiles at once before simplifying the tile body.
- **A true flight from hand to pond.** A discard lands in the pond from the
  thrower's side rather than travelling from the exact tile you tapped, which
  needs measured layouts. Ponds now sit by seat, so the target is known.
- **Sound.** Tile clacks on discard and claim would do as much as the motion.

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

### Session and soak tests are bound to wall-clock speed
**Priority:** P2
`test/session.test.ts` and `test/soak.test.ts` play whole sessions inside a
fixed loop (4000 and 6000 steps of `sleep(3)`), so on a slow or busy machine the session
simply has not ended when the loop runs out — "the session never ended". Seen
failing in about half of full runs in a cloud container, **with and without**
the v0.2.10.0 app changes stashed (the server does not import the app). The fix
is to wait on the `session-end` message with a generous deadline rather than
counting iterations, not to raise the count.

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
