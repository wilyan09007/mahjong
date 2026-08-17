# Mahjong App — Design Spec

**Date:** 2026-08-16
**Status:** Approved design, pending implementation planning

## Vision

An online multiplayer mahjong game whose core promise is **playing with friends,
conveniently**: create a table, share a link, friends join in seconds. Its
differentiators over existing market apps are (1) friction-free private games
with friends and (2) noticeably higher art and animation quality.

Ships on Android (Google Play) first, iOS (App Store) after — one codebase.

## Product decisions (settled)

| Decision | Choice |
|---|---|
| Game type | 4-player table mahjong, online multiplayer |
| Variants | Taiwanese 16-tile in v1; Cantonese (Hong Kong 13-tile) in v1.1. Engine is variant-pluggable from day one. |
| Opponents | Humans in private rooms; AI bots fill empty seats and take over disconnected players |
| Stack | TypeScript end-to-end: Expo React Native app, Node game server (Colyseus), shared rules engine |
| Monetization | Cosmetics (tile sets, table themes, avatars) sold directly + optional rewarded ads. Coins/points are free and non-purchasable — **no simulated-gambling classification, no loot boxes, no banner ads.** |
| Art | Vector-first (SVG) original tile set and themes, designed in-house; premium packs commissioned post-launch become paid cosmetics |
| Identity | v1 has no accounts: device-generated identity + chosen display name and avatar. Full accounts are a later, additive feature. |
| Orientation | Game table is landscape; menu screens portrait-capable |

## Architecture

Single monorepo, four TypeScript packages:

```
mahjong/
├── packages/
│   ├── engine/     Pure rules logic. No UI, no network, no I/O.
│   ├── server/     Authoritative Colyseus game server. Runs bots in-process.
│   ├── bot/        AI player logic. Depends only on engine.
│   └── app/        Expo React Native client.
```

### packages/engine — the rules

- Models tiles, walls, hands, melds (chow/pung/kong), flowers, turn order,
  claims and claim priority, win detection, and scoring.
- A **variant** is a pluggable configuration + scoring module implementing a
  common interface: hand size, tile set composition, legal melds, win shape,
  scoring rules, dealer-continuation rules. Taiwanese and Cantonese are two
  implementations of the same interface.
- Taiwanese v1 scope: 144 tiles (incl. 8 flowers), 16-tile hands (dealer 17),
  win = five sets + one pair, flowers auto-exposed and replaced from the dead
  wall, tai-based scoring with dealer streak (lianzhuang) bonuses, chow from
  left player only. Configurable house rules exposed in the room lobby:
  base/per-tai points, number of rounds, turn timer.
- Deterministic and side-effect free: given a state and an action, returns the
  next state. This is what makes it testable and shareable.

### packages/server — authoritative multiplayer

- **The server owns all hidden information.** The wall and every hand live only
  in server memory; each client receives a per-player filtered view (own hand,
  everyone's melds and discards, wall count — never opponents' concealed
  tiles). Colyseus's per-client state filtering implements this.
- Room lifecycle: host creates a room → 6-character join code + deep link →
  players join, host configures variant and house rules, fills empty seats
  with bots → start. Rooms are ephemeral; no database in v1.
- Turn flow: server validates every action against the engine; illegal actions
  are rejected. Claim windows (chow/pung/kong/win) with priority resolution
  and a configurable timer.
- **Disconnects:** the seat is held for the entire game. A bot plays the
  moment a player drops; the player resumes seamlessly on reconnect. The
  other three players never wait.
- Hosting: persistent Node host (Fly.io or Railway class, ~$5/mo to start) —
  live game state is in-memory, so serverless is a poor fit. If the server
  process dies, in-flight games are lost; acceptable at v1 scale and noted as
  a known limitation.

### packages/bot — AI seat-filler

- Consumes the engine's legal-move and hand-evaluation APIs.
- Discard policy: shanten (distance-to-win) minimization with basic tile
  safety. Claim policy: accept melds that improve expected hand value.
- Target strength: competent intermediate. Explicitly not a research AI.
- Runs inside the server process; a bot is just another seat whose actions
  come from code instead of a socket.

### packages/app — the client

Expo React Native, TypeScript. Rendering: React Native Skia (tile bevels,
gloss, shadows, felt texture) + Reanimated (60fps deal/draw/discard/win
animations). Five screens:

1. **Home** — display name + avatar; Create table / Join table (link or code).
2. **Room lobby** — seats, invite via share sheet, variant picker, house-rule
   toggles, fill-with-bot, host starts.
3. **Game table** (landscape) — own hand bottom with tap/drag discard; discard
   pond and wall count center; opponents' melds and discards around the
   table; large action buttons (chow/pung/kong/win) shown only when legal;
   gentle default turn timer; emotes and canned phrases (no free-text chat,
   no voice).
4. **Results** — winning hand laid out with line-by-line scoring breakdown
   (doubles as scoring education) and running session totals.
5. **Store/themes** — browse/apply cosmetics; rewarded-ad temporary unlocks.
   (Ships in v1.2 — v1 launches with the first four screens and the default
   theme only.)

## Art direction and pipeline

- **Vector-first:** all 42 unique tile faces (characters, circles, bamboo,
  winds, dragons, flowers/seasons) authored as SVG under shared design tokens
  — one palette, consistent stroke weights and corner treatments — so the set
  reads as a single crafted object. CJK glyphs (characters, winds, dragons)
  use a licensed calligraphy font converted to outlines.
- **Polish is rendering + motion**, not just assets: depth, lighting, and
  animation carry as much perceived quality as the artwork.
- **Theming system = cosmetics pipeline:** a theme is a swappable asset pack
  (tile faces, tile backs, table, sounds). Built once for the default look;
  every future cosmetic is content, not engineering.

## Monetization guardrails

- Coins/points are score-keeping only: never purchasable, never cash-out-able.
  This keeps the app out of legal gambling **and** out of the stores'
  "simulated gambling" content classification (which would force a 17+/18+
  rating and block some countries).
- Cosmetics sold directly, never in randomized boxes (loot-box odds-disclosure
  rules and per-country gambling laws are entirely avoided).
- Ads are rewarded-video only, always optional, never during play.

## Testing strategy

- The engine gets the heaviest coverage: unit tests for melds, claims, win
  detection; scoring tables for each variant verified against published rule
  references; property-style simulation tests (bot vs bot, thousands of
  hands) asserting no illegal state is ever reachable.
- Server: integration tests driving multiple simulated clients through full
  games, including disconnect/reconnect and claim-priority races.
- App: component tests for game-state rendering; manual device passes for
  animation quality.

## Delivery

- Expo EAS cloud builds produce the Android AAB and iOS IPA (no Mac needed —
  development machine is Windows) and submit to both stores.
- Google Play: $25 one-time developer fee. Apple: $99/year, added at the iOS
  phase.

## Phasing

- **v1 (Play Store):** Taiwanese variant, private rooms with link/code invite,
  bots, disconnect takeover, default theme, results/scoring screen.
- **v1.1:** Cantonese variant (rules content + scoring module + tests).
- **v1.2:** Cosmetics store, rewarded ads, additional themes; iOS submission.
- **Later (explicitly out of v1 scope):** accounts and cross-device identity,
  friends lists, stats/match history (adds the database), matchmaking with
  strangers, spectating, voice chat, commissioned premium art packs.
