# Hong Kong (Cantonese) variant — design

Status: approved 2026-11-01. Implements the spec's v1.1 "Cantonese variant".

## What the player sees

- The host picks the **ruleset in the lobby, before starting**: Taiwanese
  (16-tile, 台) or Hong Kong (13-tile, 番). Hong Kong adds four house options:
  - **Minimum to win:** Any (a 0-番 chicken hand counts), 1, **3**, or 5.
    A hand under the minimum is never offered as a win.
  - **Maximum:** 10 (Hong Kong Mahjong Association) or **13** (traditional).
  - **Payment:** **half spicy** (半辣) or full spicy (全辣).
  - **Seven pairs:** **on** or off.
  Bold = default.
- The table plays 13-tile hands; the score sheet counts 番.

## Rules that differ from Taiwanese

- 13 tiles each, the dealer 14. Dealt 4-4-4-1, dealer one more.
- Everything else at the table is shared: flowers auto-replaced from the back
  of the wall, chow from the left only, win > kong = pung > chow, robbing an
  added kong, the 16-tile wall floor, dealer keeps the deal on a win or draw.
- Win shapes: four sets and a pair, plus **seven pairs** (seven distinct pairs,
  when enabled) and **thirteen orphans**, both fully concealed.

## The 番 table

Hand patterns: 雞糊 chicken hand 0 · 平糊 all chows 1 · 花幺九 terminals and
honours only 1 (+3, it is always all pungs) · 對對糊 all pungs 3 · 混一色 half
flush 3 · **七對子 seven pairs 5** · 小三元 little three dragons 5 · 小四喜 little
four winds 6 · 清一色 full flush 7 · 大三元 big three dragons 8.

Extras: 番子 dragon pung 1 each · 門風 seat-wind pung 1 · 圈風 round-wind pung 1 ·
自摸 self-drawn 1 · 門前清 fully concealed 1 (not for hands concealed by
definition) · 無花 no flowers 1 · 正花 own flower / own season 1 each ·
一台花 all four flowers or all four seasons 2 (replaces that set's 正花) ·
槓上開花 win on a kong replacement 1 · 槓上槓 win after two kongs in a row 8
(replaces 槓上開花) · 搶槓 robbing a kong 1 · 海底撈月 last tile 1.

Suppression: 小三元/大三元 replace the dragon pungs they contain; 小四喜 replaces
the wind pungs.

Limit hands (no extras; the best one counts): 字一色 all honours 10 · 坎坎糊 four
concealed pungs 10 · 清么九 all terminals 10 · 九子連環 nine gates 10 · 大四喜 big
four winds 13 · 十八羅漢 four kongs 13 · 十三么 thirteen orphans 13 · 天糊
heavenly hand 13 · 地糊 earthly hand 13.

The total is capped at the chosen maximum (a 13 becomes 10 under a 10 cap).
As in Taiwanese scoring, every reading of the tiles is scored and the best wins.

## Payment

Points per 番 (half spicy / full spicy): 0→1, 1→2, 2→4, 3→8, 4→16 for both;
then half spicy 24, 32, 48, 64, 96, 128, 192, 256, 384 and full spicy doubling
(32 … 8192) for 5–13 番. A discard win: the discarder pays the table value.
A self-draw: each of the other three pays half of it. No dealer bonus.

## Out of scope

Seven/eight-flower instant wins, discarder-pays-half, custom point tables,
dividing points by a constant. All are house variations for later.
