# Deployment runbook (Plan 4)

Every artifact is in the repo. Everything left is an account action, a build, or
a console form — none of which can be done from a dev machine's shell without
your credentials. This is the checklist, in order.

## Status

| Step | Artifact | State |
|---|---|---|
| Server container | `packages/server/Dockerfile`, `.dockerignore` | ✅ written · ⚠️ image never built (Docker Desktop not running here) |
| Fly config | `fly.toml` | ✅ written · ⚠️ never deployed |
| App identity | `packages/app/app.json` | ✅ id, scheme, version set · ⚠️ icon/splash art missing |
| EAS profiles | `packages/app/eas.json` | ✅ written · ⚠️ never built |
| Privacy policy | `docs/privacy-policy.md` | ✅ written · ⚠️ not published |
| Store listing | `packages/app/assets/store/listing.md` | ✅ copy + every declaration answer · ⚠️ no graphics, not uploaded |

**Verified here:** the server boots exactly as the Dockerfile's `CMD` starts it
(`pnpm -F @mahjong/server exec tsx src/index.ts`), serves `{"ok":true}` on
`/health`, and accepts a real colyseus.js client that creates a room and
receives its lobby message. The image build itself is unverified.

## 1 · Server on Fly.io

```bash
# Verify the image locally first (needs Docker Desktop running)
docker build -t mahjong-server -f packages/server/Dockerfile .
docker run -p 2567:2567 mahjong-server
curl http://localhost:2567/health          # {"ok":true}

# Deploy
iwr https://fly.io/install.ps1 -useb | iex  # [HUMAN] install flyctl
fly auth signup                             # [HUMAN] account + payment method
fly launch --no-deploy --copy-config        # accept the existing fly.toml
fly deploy
fly scale count 1                           # exactly one, always

curl https://wilyan-mahjong.fly.dev/health
fly logs                                    # confirm a clean boot
```

**If `wilyan-mahjong` is taken,** change `app` in `fly.toml` AND the two
`EXPO_PUBLIC_SERVER_URL` values in `eas.json`. Those are the only two places the
hostname appears.

**One machine, always on, is not a default to tune away.** Games live in process
memory: a second instance holds rooms the first cannot see, and a stopped
machine is a dead table mid-hand. Deploying restarts the process and ends every
game in progress — deploy at quiet hours.

## 2 · App art

Still missing: `icon.png` (1024²), `adaptive-icon.png` (foreground with ~25%
transparent margin), `splash.png`, plus `assets/store/icon.png` (512²) and
`assets/store/feature-graphic.png` (1024×500).

Cheapest source is the app itself — open `/dev-gallery`, screenshot the 中
dragon tile on the felt background, and crop. Then add the `icon`, `splash` and
`android.adaptiveIcon.foregroundImage` paths to `app.json`.

## 3 · Builds

```bash
npm i -g eas-cli && eas login            # [HUMAN] Expo account
eas build -p android --profile preview   # installable APK, points at Fly
eas build -p android --profile production # signed .aab for Play
```

Let EAS generate and hold the upload keystore. `appVersionSource: "remote"` plus
`autoIncrement` means EAS owns the version code — do not also bump
`android.versionCode` by hand.

## 4 · Play Console — [HUMAN] throughout

1. Publish the privacy policy: repo Settings → Pages → deploy from `/docs` on
   `main`. Put the resulting URL in the listing.
2. Pay the $25 registration, verify identity.
3. Create the app: Game → Board, Free.
4. Fill Data safety, IARC content rating, ads, and target audience **only** from
   the answer table in `packages/app/assets/store/listing.md`. It is exhaustive
   and matches what the app actually does; improvising there is how apps get
   mis-rated.
5. Upload icon, feature graphic, 4 landscape screenshots, and the copy.

## 5 · Closed testing

New personal developer accounts must run a closed test with a minimum number of
testers opted in continuously for **14 days** before applying for production
(currently 12 — the console shows the live number). The friend group is the
test track; that is the point.

Collect issues in `docs/beta-feedback.md`. Fix on `main` with a regression test
first, as usual. Ship fixes with `eas build -p android --profile production`
then `eas submit -p android` (needs a Google Cloud service-account JSON linked
in the console's API access page).

Watch `fly logs` after each session. Any unhandled rejection is a bug to
reproduce as a server test — `packages/server/test/soak.test.ts` already fails
the suite on one.

## 6 · Production

Apply for production access, promote the tested `.aab`, roll out at **20%**,
watch Play vitals and `fly logs` for 48h, then 100%. Tag `v1.0.0`.

## 7 · Same week

- Crash reporting: `npx @sentry/wizard@latest -i reactNative`, plus Sentry's
  Node SDK in the server. **This adds data collection** — update
  `docs/privacy-policy.md` and the Play data-safety form to declare crash logs
  not linked to identity.
- Free UptimeRobot monitor on `/health`.
