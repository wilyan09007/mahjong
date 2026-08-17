# @mahjong/server

Authoritative Colyseus room server for private mahjong tables. Holds the wall
and every hand; sends each client only what that seat is allowed to know.

```bash
pnpm dev:server                       # http://localhost:2567
curl http://localhost:2567/health     # {"ok":true}
NODE_ENV=test pnpm -F @mahjong/server test
```

## ⚠️ The invariant

**The only game data that ever reaches a client is a `PlayerView`.**

Never `GameState`, never `tiles`, never `wallFront`/`wallBack`, never `seed`,
never another player's `hand`. `TableRoom.pushViews()` is the single place game
data leaves the process, and it calls the engine's `viewFor`. Every server test
that touches a `view` asserts this (`test/util.ts → assertNoHiddenInfo`).

This is also why the room is **not** a Colyseus schema room: schema sync
broadcasts one shared state to everyone, which is precisely wrong for a
hidden-information game. The authoritative `GameState` is a plain object that is
never synchronised.

## Joining

Room identity is the six-character join code — it *is* the Colyseus `roomId`.

```ts
const client = new Client('ws://localhost:2567');
const room = await client.create('table', { playerId, name });   // host
const room = await client.joinById('ABC234', { playerId, name }); // friend
```

Codes come from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no I, O, 0 or 1, because
codes get read aloud and typed off photos. They are reserved against a presence
set, so two live rooms can never share one.

**`playerId` is identity, not the connection.** Rejoining with the same
`playerId` reclaims the same seat, which is what makes reconnection seamless. A
join without one is rejected.

## Wire protocol

### client → server

| Message | Payload | Rules |
|---|---|---|
| *join options* | `{ playerId: string, name: string }` | required on `create` / `joinById` |
| `config` | `{ totalRounds?: 1\|2\|4, base?, perTai?, turnSeconds?, claimSeconds? }` | host only, lobby only |
| `fill-bot` | `{ seat: Seat }` | host only, lobby only, seat must be empty |
| `remove-bot` | `{ seat: Seat }` | host only, lobby only, seat must be a bot |
| `start` | `{}` | host only, requires all 4 seats filled |
| `action` | `{ action: Action }` | `action.seat` **must** be the sender's seat |
| `emote` | `{ emote: string }` | ≤ 8 chars, rate-limited 1/sec/seat |

### server → client

| Message | Payload | When |
|---|---|---|
| `lobby` | `{ code, hostPlayerId, config, seats: SeatPublic[] }` | after every lobby change |
| `view` | `PlayerView` | to each seated human after every transition |
| `hand-result` | `{ result: HandResult, scores: [n,n,n,n] }` | a hand ends; `scores` are running session totals |
| `seat-status` | `{ seat: Seat, connected: boolean }` | someone drops or returns mid-game |
| `session-end` | `{ standings: { seat, name, score }[] }` | configured rounds complete; sorted best-first |
| `error` | `{ message: string }` | a rejected message, to the sender only |
| `emote` | `{ seat: Seat, emote: string }` | rebroadcast |

`SeatPublic = { seat, kind: 'human'|'bot'|'empty', name, connected }`. Note it
carries **no `playerId`** — only `hostPlayerId` is shared, and only so a client
can tell whether it is the host.

## Behaviour worth knowing

**Illegal actions self-heal.** A rejected action gets an `error` *and a fresh
`view`*, so a client whose picture drifted repairs itself instead of sitting
desynchronised. Any non-`IllegalActionError` exception is a server bug and is
rethrown rather than swallowed.

**Everything scheduled is generation-guarded.** Every bot move, turn timer,
claim timer and inter-hand pause captures a `generation` counter and aborts if
the table moved on. Timers are re-armed after *every* transition — which matters
in a claim window where several seats owe a response: the first response
invalidates the others' pending timers, and the re-arm schedules fresh ones for
whoever has not answered. Without it the window would deadlock.

**Nobody can stall the table.** A seat that does not answer is played for:
bots after `botDelayMs`, a silent human after `turnSeconds` on their own turn,
or `claimSeconds` in a claim window (where they are passed, not made to claim
something they never chose). A disconnected human's seat is held and covered by
a bot immediately.

**Timing is configurable, and test overrides are gated.** Join options may carry
`__test: { turnSeconds, claimSeconds, botDelayMs, interHandMs }`, honoured
**only** when `NODE_ENV === 'test'` — otherwise a client could shorten its own
turn timer.

Defaults: `turnSeconds 30`, `claimSeconds 7`, `botDelayMs 700`,
`interHandMs 5000`, `totalRounds 1`, `base 3`, `perTai 1`.

## Sessions

A hand ends → payments are added to running `scores` → `hand-result`. If the
configured rounds are complete, `session-end` fires with standings and the room
returns to the lobby with seats intact, so the host can reconfigure and `start`
again. Otherwise the next hand begins after `interHandMs`.

`totalRounds` is 1, 2 or 4 laps of the deal (4 = 全莊). Scores are always
zero-sum: points move between players and are never created.

## Operational notes

Games live in memory, so **this process is the game**. Exactly one instance ever
runs (see `fly.toml`): a second would hold rooms the first cannot see, and a
restart ends every table in progress. Deploy at quiet hours. This is an accepted
v1 limitation, not an oversight.

Server-side randomness (room codes, hand seeds) uses `crypto.randomInt`. The
*engine* stays seeded and reproducible: given a hand's seed it replays exactly,
which is what makes a bug report actionable.
