# Mahjong v1 — Plan 4: Server Deploy + Google Play Delivery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Several steps here are account/console actions only the human can perform — those are marked **[HUMAN]** and the task pauses until done.

**Goal:** Put the Plan 2 server on the public internet, produce a signed Android build with EAS, and take the app through Google Play closed testing to production.

**Architecture:** Single Fly.io machine runs the Colyseus server (games are in-memory, so exactly **one** always-on instance — no autoscaling, no auto-stop). The app's production build points at it over `wss://`. EAS cloud builds sign and produce the `.aab`; Play App Signing manages the release key. v1 collects no analytics and shows no ads, keeping the Play data-safety story minimal.

**Tech Stack:** Docker, Fly.io (`flyctl`), EAS CLI (`eas-cli`), Google Play Console.

**Spec:** `docs/superpowers/specs/2026-08-16-mahjong-app-design.md`
**Depends on:** Plans 1–3 complete; root `pnpm test` green.

## Global Constraints

- One server instance only (`min_machines_running = 1`, `auto_stop_machines = 'off'`, count 1) — live games die with the process; never scale horizontally in v1.
- Android application id: **`com.wilyan.mahjong`** — permanent once published; confirm with the user before the first Play upload.
- Production server URL is set ONLY via `EXPO_PUBLIC_SERVER_URL` in `eas.json` build profiles — never hardcoded.
- Nothing in this plan adds analytics, ads, or data collection beyond: display name (user-entered), device-generated player id, transient gameplay traffic. Every console form is answered from exactly that list.
- Costs to expect: Fly ~$3–6/mo, Play Console $25 one-time. No other spend.

## File Structure

```
packages/server/Dockerfile
fly.toml                          # repo root (deploys packages/server)
packages/app/eas.json
packages/app/app.json             # updated: identity, icon, splash
packages/app/assets/store/        # icon.png 512², feature-graphic.png 1024×500, screenshots/
docs/privacy-policy.md            # published via GitHub Pages
```

---

### Task 1: Containerize and deploy the server

**Files:**
- Create: `packages/server/Dockerfile`, `fly.toml`

- [ ] **Step 1: Write the Dockerfile** (runs TS directly with tsx — the monorepo's engine/bot are TS source):

```dockerfile
FROM node:22-slim
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/bot/package.json packages/bot/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile --filter @mahjong/server...
COPY packages/engine packages/engine
COPY packages/bot packages/bot
COPY packages/server packages/server
ENV NODE_ENV=production PORT=2567
EXPOSE 2567
CMD ["pnpm", "-F", "@mahjong/server", "exec", "tsx", "src/index.ts"]
```

- [ ] **Step 2: Verify locally:** `docker build -t mahjong-server -f packages/server/Dockerfile .` then `docker run -p 2567:2567 mahjong-server`; `curl http://localhost:2567/health` → `{"ok":true}`, and a quick room-creation check with a Node one-liner using `colyseus.js` against `ws://localhost:2567`. (No Docker on the machine → install Docker Desktop, or skip local verify and rely on Fly's remote builder.)
- [ ] **Step 3: [HUMAN] Fly account:** install flyctl (`iwr https://fly.io/install.ps1 -useb | iex`), `fly auth signup` (or login), add a payment method.
- [ ] **Step 4: Write `fly.toml`** (root):

```toml
app = "wilyan-mahjong"           # adjust if taken
primary_region = "lax"           # pick nearest the friend group

[build]
  dockerfile = "packages/server/Dockerfile"

[http_service]
  internal_port = 2567
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    method = "GET"
    path = "/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- [ ] **Step 5: Deploy and smoke-test:** `fly launch --no-deploy --copy-config` (accept existing fly.toml), `fly deploy`, then `fly scale count 1`. Verify: `curl https://wilyan-mahjong.fly.dev/health`; then run the colyseus.js one-liner against `wss://wilyan-mahjong.fly.dev` — create a room, receive a `lobby` message. Check `fly logs` for clean boot.
- [ ] **Step 6: Real-device test:** point the dev app at production (`EXPO_PUBLIC_SERVER_URL=https://wilyan-mahjong.fly.dev` in a `.env`), play one bot game on the phone over mobile data (not Wi-Fi — proves the public path).
- [ ] **Step 7: Commit** — `chore(deploy): dockerfile and fly.io config for the game server`

---

### Task 2: App production identity — id, icon, splash

**Files:**
- Modify: `packages/app/app.json`; Create: `packages/app/assets/icon.png`, `adaptive-icon.png`, `splash.png`, `packages/app/assets/store/*`

- [ ] **Step 1: [HUMAN] Confirm the application id** `com.wilyan.mahjong` (permanent) and the public app name (working title: **"Mahjong with Friends"** — user's call; store listing can differ from the launcher label).
- [ ] **Step 2: Produce icon + splash from the Task-2/Plan-3 art:** render a single hero tile (red 中 dragon face on the ivory tile body, felt-green background) at 1024² via the dev-gallery screen + screenshot, or export the SVG through `resvg`/Figma. Files: `icon.png` (1024²), `adaptive-icon.png` (foreground, transparent margin ~25%), `splash.png` (tile centered on `tokens.color.tableFelt`). Store assets: `store/feature-graphic.png` 1024×500 (tile row + wordmark), `store/icon.png` 512².
- [ ] **Step 3: Update `app.json`:** `"name"`, `"slug": "mahjong"`, `"scheme": "mahjong"` (already set), `"orientation": "default"`, `"android": { "package": "com.wilyan.mahjong", "adaptiveIcon": {...}, "versionCode": 1 }`, `"icon"`, `"splash"` blocks, `"version": "1.0.0"`.
- [ ] **Step 4:** Boot on emulator; launcher icon and splash render correctly. **Commit** — `feat(app): production identity, icon, and splash`

---

### Task 3: EAS build pipeline → signed .aab

**Files:**
- Create: `packages/app/eas.json`

- [ ] **Step 1: [HUMAN]** Create/confirm an Expo account; `npm i -g eas-cli`; `eas login`.
- [ ] **Step 2: Write `eas.json`:**

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true, "distribution": "internal",
      "env": { "EXPO_PUBLIC_SERVER_URL": "http://10.0.2.2:2567" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_SERVER_URL": "https://wilyan-mahjong.fly.dev" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_SERVER_URL": "https://wilyan-mahjong.fly.dev" }
    }
  },
  "submit": { "production": { "android": { "track": "internal" } } }
}
```

- [ ] **Step 3:** `eas build -p android --profile preview` (produces an installable `.apk`); install on the phone (`eas build` gives a QR/URL), play a production-server bot game — this is the first fully-standalone build (no Expo Go).
- [ ] **Step 4:** `eas build -p android --profile production` → signed `.aab` (let EAS generate and manage the upload keystore). Download and keep the URL handy for Task 4.
- [ ] **Step 5: Commit** — `chore(app): eas build profiles`

---

### Task 4: Play Console — account, listing, policy forms

Everything here is **[HUMAN]** console work; prepare all text/assets in-repo first so the console session is mechanical.

- [ ] **Step 1: Prepare listing copy** in `packages/app/assets/store/listing.md`: app name; short description (≤80 chars, e.g. "Taiwanese 16-tile mahjong with friends — private tables, no ads mid-game."); full description (lead with private-rooms-with-friends, 16-tile Taiwanese rules, AI seat-filling, free scoring — no gambling, no purchasable coins); category **Board**; contact email.
- [ ] **Step 2: Screenshots:** at least 4 landscape phone screenshots from the emulator/device (table mid-hand, claim moment, win overlay with tai breakdown, lobby with friends+bot). `adb exec-out screencap -p > shot1.png`. Place in `store/screenshots/`.
- [ ] **Step 3: Privacy policy:** write `docs/privacy-policy.md` — plain-English: what's stored (chosen display name, a random device identifier, room/game traffic while playing), what's not (no accounts, no ads, no analytics, no selling data, nothing shared with third parties), retention (gameplay state is in-memory and gone when the room closes), contact email, effective date. Publish via GitHub Pages (**[HUMAN]**: repo Settings → Pages → deploy `/docs`) → a stable public URL.
- [ ] **Step 4: [HUMAN] Play Console:** pay the $25 registration (personal account), verify identity. Create the app (name, default language, App/Game → Game, Free).
- [ ] **Step 5: [HUMAN] Fill the declarations,** answering ONLY from the Global Constraints data list: **Data safety** — collects display name (app functionality, not shared) and device ID (app functionality, not shared), no location/financial/etc., data encrypted in transit, no deletion account needed (nothing persisted). **Content rating (IARC)** — no violence/sex/drugs; gambling questions: no real-money gambling, no simulated-gambling wagering (points are a free score, nothing purchasable) — expect an Everyone/PEGI-3-class rating. **Ads:** none. **Target audience:** 13+ (avoids designed-for-children obligations). Government-apps/News/COVID/Financial: no.
- [ ] **Step 6: [HUMAN] Store listing:** upload icon 512², feature graphic, screenshots, copy from `listing.md`, privacy-policy URL.
- [ ] **Step 7: Commit** the in-repo artifacts — `docs: store listing assets and privacy policy`

---

### Task 5: Closed testing (the friend group IS the test track)

- [ ] **Step 1: [HUMAN]** Play Console → Testing → **Closed testing** → create track "friends": upload the Task-3 `.aab` (first upload is manual through the console; later ones can use `eas submit`), add release notes, add testers by email list, save + roll out to the track.
- [ ] **Step 2: Note the personal-account gate:** new personal developer accounts must run closed testing with a minimum tester count opted in continuously for **14 days** before they can apply for production (currently 12 testers — the console shows the exact current number). The friend group + their friends covers this; send the opt-in link the console generates. Track opt-in status on the console daily.
- [ ] **Step 3: The 14-day soak is real QA:** friends play real sessions. Collect issues in a `docs/beta-feedback.md` triage list. Fix engine/server/app bugs on `main` (each fix follows the normal TDD workflow — regression test first). Ship fixed builds to the track: `eas build -p android --profile production` then `eas submit -p android` (after **[HUMAN]** links a Google Cloud service-account JSON in the Play Console API access page, per the eas-cli prompt).
- [ ] **Step 4:** During the soak, watch `fly logs` for server errors after each session; any unhandled rejection is a bug to reproduce in a server test.
- [ ] **Step 5: Commit** ongoing fixes normally; keep `pnpm test` green.

---

### Task 6: Production release

- [ ] **Step 1: [HUMAN]** After the 14-day requirement clears: Play Console → apply for production access (the questionnaire asks how testing went; answer from `beta-feedback.md`).
- [ ] **Step 2: [HUMAN]** Promote the latest tested build: Production → create release from the closed-track `.aab` → **staged rollout at 20%** → review + roll out. Monitor for 48h (Play vitals: crashes/ANRs; `fly logs`), then raise to 100%.
- [ ] **Step 3:** Tag the repo: `git tag v1.0.0 && git push --tags`. Update README with the Play Store link once live.

---

### Task 7: Post-launch guardrails (small, do them the same week)

- [ ] **Step 1: Crash reporting:** add `@sentry/react-native` via `npx @sentry/wizard@latest -i reactNative` (free tier), plus Sentry's Node SDK in the server (`Sentry.init` in `index.ts`, capture in the room's error paths). Rebuild + ship to the track first, then production. *(This adds crash data collection — update the privacy policy page and the Play data-safety form: crash logs, not linked to identity.)*
- [ ] **Step 2: Uptime:** free UptimeRobot monitor on `https://wilyan-mahjong.fly.dev/health`, alert to email.
- [ ] **Step 3: Server deploy discipline:** deploying restarts the machine and kills live games — deploy at low-traffic hours; later (post-v1) consider drain-aware deploys.
- [ ] **Step 4:** Open `docs/superpowers/specs/` backlog notes for v1.1 (Cantonese variant — engine `Variant` seam) and v1.2 (cosmetics store + rewarded ads + iOS, which adds the Apple $99/yr account and `eas build -p ios` — no Mac needed). Each starts with its own brainstorm→spec→plan cycle per the spec's phasing.
- [ ] **Step 5: Commit** — `chore: post-launch monitoring`

---

## Self-Review (completed at authoring time)

- **Spec coverage:** EAS cloud builds + Play-first delivery (T3–T6), $25/$99 fees noted where they land, ephemeral-server hosting constraint enforced (one instance, T1), monetization guardrails respected (v1 ships zero ads/IAP; the data-safety and IARC answers encode the no-gambling stance), iOS explicitly deferred to v1.2 (T7).
- **Placeholders:** none — every console form has its answers listed; every command is concrete. Human-only steps are explicitly marked.
- **Consistency:** server URL, app id, and app name appear each in exactly one authoritative place (fly.toml / app.json / listing.md) and are referenced, not duplicated.
