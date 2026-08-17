# Play Store listing copy

Prepared in-repo so the console session is mechanical. Everything below is
final text — paste it, don't rewrite it there.

---

## App name (30 chars max)

```
Mahjong with Friends
```

## Short description (80 chars max)

```
Taiwanese 16-tile mahjong with friends. Private tables, no ads mid-game.
```

*(72 characters.)*

## Full description (4000 chars max)

```
Play real Taiwanese mahjong with your friends, in seconds.

Create a table, share the code, and they're in. No accounts, no sign-ups, no
adding anyone as a "friend" first — just a six-character code or a link.

FOR YOUR GROUP, NOT FOR STRANGERS
Every table is private. You choose who's at it. Empty seats fill with capable
AI players, so three of you never have to wait for a fourth — and if someone's
train goes into a tunnel, a bot covers their seat instantly and hands it back
the moment they reconnect. Nobody sits waiting.

PROPER TAIWANESE RULES
Full 16-tile Taiwanese mahjong: 144 tiles, flowers, chow, pung, kong, robbing
the kong, dealer streaks (連莊), and the complete tai scoring table — 平胡,
碰碰胡, 混一色, 清一色, 大三元, 大四喜, 字一色, 四暗刻 and the rest. House
rules for base and per-tai points, and 1, 2 or 4 rounds.

SCORING YOU CAN ACTUALLY LEARN
Every hand ends with the score broken down line by line, so you can see exactly
which patterns paid and why. If you've ever nodded along while someone counted
tai, this is the app that explains it.

MADE TO LOOK GOOD
Original hand-drawn tile art, a felt table, and animation that makes the tiles
feel like objects rather than pictures of objects.

NO GAMBLING, NO ADS DURING PLAY
Points are a score, nothing more. They cannot be bought, and they cannot be
cashed out. There is no real-money wagering, no loot boxes, and no banner ads
interrupting a hand.

Android now. More variants coming — Cantonese (Hong Kong 13-tile) is next.
```

## Category

Game → **Board**

## Tags

mahjong, board game, multiplayer, friends, Taiwanese mahjong, 麻將

## Contact

- Email: wilyan090@gmail.com
- Privacy policy: `https://<github-username>.github.io/mahjong/privacy-policy`
  (publish `docs/` via GitHub Pages — repo Settings → Pages → deploy from
  `/docs` on `main`)

## Graphics required

| Asset | Size | Source |
|---|---|---|
| App icon | 512×512 PNG | Red 中 dragon face on ivory tile, felt-green ground |
| Feature graphic | 1024×500 PNG | Row of tiles + wordmark |
| Phone screenshots | ≥ 4, landscape | See below |

**Screenshots to capture** (`adb exec-out screencap -p > shot1.png`):

1. Table mid-hand — full board, own hand, opponents' melds visible
2. A claim moment — 吃/碰/槓 buttons lit
3. Win overlay — winning hand with the tai breakdown listed
4. Lobby — room code large, friends plus a bot seated

## Store declaration answers

Answer from this list and nothing else — it is exhaustive.

**Data safety**

| Question | Answer |
|---|---|
| Collects data? | Yes — display name, device identifier |
| Display name | App functionality. Not shared. Not linked to identity. Optional? No. |
| Device ID | App functionality. Not shared. Used to restore a seat after a disconnect. |
| Location / financial / health / contacts / photos / files / messages | None |
| Encrypted in transit? | Yes |
| Can users request deletion? | Nothing is persisted server-side; on-device data is removed by uninstalling |

**Content rating (IARC)** — no violence, no sexuality, no drugs, no profanity.
Gambling questions: **no** real-money gambling, **no** simulated gambling.
Points are a free score that cannot be purchased or cashed out, and there is no
wagering. Expect an Everyone / PEGI 3 rating.

**Ads:** None.
**In-app purchases:** None.
**Target audience:** 13+ (keeps the app out of Families policy obligations).
**Government / news / COVID / financial app:** No to all.
