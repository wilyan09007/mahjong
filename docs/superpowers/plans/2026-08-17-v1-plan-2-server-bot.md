# Mahjong v1 — Plan 2: Authoritative Server + Bots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@mahjong/server` (Colyseus room server: private tables with join codes, per-player filtered views, timers, disconnect takeover) and `@mahjong/bot` (shanten-driven AI that fills seats), fully driven by `@mahjong/engine`.

**Architecture:** The room holds the authoritative `GameState` as a plain object (never synced via Colyseus schema). After every transition it sends each client a `PlayerView` built by the engine's `viewFor` — the single choke point that filters hidden information. Bots are seats whose actions come from `chooseBotAction(view)` instead of a socket; a disconnected human's seat is bot-driven until they rejoin. Room identity = a 6-character join code used as the Colyseus `roomId`.

**Tech Stack:** colyseus ^0.16, @colyseus/tools, @colyseus/testing, Vitest, tsx (dev runner).

**Spec:** `docs/superpowers/specs/2026-08-16-mahjong-app-design.md`
**Depends on:** Plan 1 (`docs/superpowers/plans/2026-08-16-v1-plan-1-engine.md`) — this plan is written against Plan 1's Interfaces blocks. **Before executing, diff those signatures against the real `packages/engine/src/index.ts`; if implementation drifted, update this plan's imports first.**

## Global Constraints

- All Plan 1 global constraints still apply (Node ≥ 20, pnpm, strict TS, conventional commits, commit per task).
- **The wire never carries hidden information.** Clients receive only `PlayerView`s and lobby/result messages — never `GameState`, never `tiles`, `wallFront/Back`, or another player's `hand`. Every server test that touches messages asserts this.
- The server may use real randomness (`crypto.randomInt`) for seeds and room codes — the *engine* stays seeded-deterministic.
- All timing (turn/claim timers, bot think-delay) comes from room config so tests can set them to 0/short values. Defaults: `turnSeconds: 30`, `claimSeconds: 7`, `botDelayMs: 700`.
- Wire protocol message names are frozen in Task 5/6 tables — Plan 3 (the app) is written against them.

## File Structure

```
packages/engine/src/view.ts        # Task 1 (engine addition): viewFor + PlayerView
packages/bot/
├── package.json                   # @mahjong/bot, depends on @mahjong/engine
├── tsconfig.json
├── src/shanten.ts                 # 16-tile distance-to-win
├── src/bot.ts                     # chooseBotAction(view)
└── test/{shanten,bot}.test.ts
packages/server/
├── package.json                   # @mahjong/server, depends on engine + bot
├── tsconfig.json
├── src/app.config.ts              # @colyseus/tools config (rooms + express)
├── src/index.ts                   # listen()
├── src/roomCode.ts                # 6-char code generator
├── src/TableRoom.ts               # the room: seats, lifecycle, timers, bots
└── test/{roomCode,lobby,gameflow,bots,timers,reconnect,session}.test.ts
```

---

### Task 1: `viewFor` — the filtered player view (engine addition)

**Files:**
- Create: `packages/engine/src/view.ts`; Modify: `packages/engine/src/index.ts` (export it)
- Test: `packages/engine/test/view.test.ts`

**Interfaces:**
- Consumes: `GameState`, `legalActions`, engine types.
- Produces (frozen — server transports it, bot and app consume it):

```ts
export interface OpponentView {
  seat: Seat; handCount: number; melds: Meld[]; flowers: FlowerKind[]; discards: TileKind[];
  // NOTE: no `hand` field exists on this type — that is the security boundary.
}
export interface PlayerView {
  seat: Seat;
  hand: TileKind[]; melds: Meld[]; flowers: FlowerKind[]; discards: TileKind[];
  opponents: [OpponentView, OpponentView, OpponentView]; // seats (me+1)%4, (me+2)%4, (me+3)%4
  wallCount: number;
  dealer: Seat; dealerStreak: number; roundWind: Wind;
  turn: Seat; phase: Phase;
  lastDiscard: { tile: TileKind; by: Seat } | null;
  legalActions: Action[];       // MY legal actions only
  result: HandResult | null;    // revealed to everyone once finished
}
export function viewFor(state: GameState, seat: Seat): PlayerView
```

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/view.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newHand, viewFor, legalActions } from '../src/index.js';

describe('viewFor', () => {
  const state = newHand({ seed: 77, dealer: 0, dealerStreak: 0, roundWind: 'E' });

  it('includes my hand and my legal actions', () => {
    const v = viewFor(state, 0);
    expect(v.hand).toEqual(state.players[0].hand);
    expect(v.legalActions).toEqual(legalActions(state, 0));
  });
  it('NEVER exposes opponent hands or the wall', () => {
    const v = viewFor(state, 1);
    const json = JSON.parse(JSON.stringify(v));
    for (const opp of json.opponents) {
      expect(opp.hand).toBeUndefined();
      expect(typeof opp.handCount).toBe('number');
    }
    expect(json.tiles).toBeUndefined();
    expect(json.wallFront).toBeUndefined();
    expect(json.wallBack).toBeUndefined();
    expect(typeof json.wallCount).toBe('number');
  });
  it('orders opponents clockwise from me', () => {
    const v = viewFor(state, 2);
    expect(v.opponents.map((o) => o.seat)).toEqual([3, 0, 1]);
  });
  it('property: for every seat, serialized view contains at most that seat\'s 17 concealed tiles', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const v = viewFor(state, seat);
      const total = v.hand.length + v.opponents.reduce((n, o) => n + o.handCount, 0);
      expect(total).toBe(state.players.reduce((n, p) => n + p.hand.length, 0));
    }
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm -F @mahjong/engine test`, FAIL.

- [ ] **Step 3: Implement `view.ts`**

```ts
import { legalActions } from './game.js';
import type { GameState, Phase, HandResult } from './game.js';
import type { Meld } from './melds.js';
import type { FlowerKind, Seat, TileKind, Wind } from './tiles.js';
import type { Action } from './game.js';

export interface OpponentView {
  seat: Seat; handCount: number; melds: Meld[]; flowers: FlowerKind[]; discards: TileKind[];
}
export interface PlayerView {
  seat: Seat;
  hand: TileKind[]; melds: Meld[]; flowers: FlowerKind[]; discards: TileKind[];
  opponents: [OpponentView, OpponentView, OpponentView];
  wallCount: number;
  dealer: Seat; dealerStreak: number; roundWind: Wind;
  turn: Seat; phase: Phase;
  lastDiscard: { tile: TileKind; by: Seat } | null;
  legalActions: Action[];
  result: HandResult | null;
}

export function viewFor(state: GameState, seat: Seat): PlayerView {
  const me = state.players[seat];
  const opponents = [1, 2, 3].map((i) => {
    const s = ((seat + i) % 4) as Seat;
    const p = state.players[s];
    return {
      seat: s, handCount: p.hand.length,
      melds: p.melds, flowers: p.flowers, discards: p.discards,
    };
  }) as PlayerView['opponents'];
  return {
    seat,
    hand: me.hand, melds: me.melds, flowers: me.flowers, discards: me.discards,
    opponents,
    wallCount: state.wallBack - state.wallFront + 1,
    dealer: state.dealer, dealerStreak: state.dealerStreak, roundWind: state.roundWind,
    turn: state.turn, phase: state.phase,
    lastDiscard: state.lastDiscard,
    legalActions: legalActions(state, seat),
    result: state.result,
  };
}
```

Export `viewFor`, `PlayerView`, `OpponentView` from `index.ts`.

- [ ] **Step 4: Run to verify pass** — PASS. **Step 5: Commit** — `feat(engine): filtered per-seat player view`

---

### Task 2: Bot package + 16-tile shanten (`shanten.ts`)

**Files:**
- Create: `packages/bot/package.json`, `packages/bot/tsconfig.json`, `packages/bot/src/shanten.ts`
- Test: `packages/bot/test/shanten.test.ts`

**Interfaces:**
- Consumes: `winningTiles`, `kindIndex`, `NON_FLOWER_KINDS`, `isWinningHand` from `@mahjong/engine`.
- Produces: `shanten16(concealed: TileKind[], meldCount: number): number` — `-1` = winning shape, `0` = tenpai (waiting), `n > 0` = n effective draws away. Contract: for a hand with `len % 3 === 1`, `shanten16 === 0 ⟺ winningTiles(...).length > 0`.

`packages/bot/package.json`:
```json
{
  "name": "@mahjong/bot", "version": "0.1.0", "private": true, "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@mahjong/engine": "workspace:*" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
```

- [ ] **Step 1: Write the failing tests**

`packages/bot/test/shanten.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { shanten16 } from '../src/shanten.js';
import { winningTiles, type TileKind } from '@mahjong/engine';

describe('shanten16', () => {
  it('-1 for a winning 17-tile hand', () => {
    const win: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we',
    ];
    expect(shanten16(win, 0)).toBe(-1);
  });
  it('0 for tenpai, agreeing with winningTiles', () => {
    const tenpai: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we',
    ];
    expect(shanten16(tenpai, 0)).toBe(0);
    expect(winningTiles(tenpai).length).toBeGreaterThan(0);
  });
  it('1 for one-away', () => {
    const oneAway: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'we', 'ws',
    ];
    expect(shanten16(oneAway, 0)).toBe(1);
  });
  it('respects melds (shorter concealed hands)', () => {
    // 2 melds out: concealed 10 tiles, tenpai on pair wait
    expect(shanten16(['9b', '1t', '1t', '1t', '2t', '3t', '4t', '5t', '6t', '7t'], 2)).toBe(0);
  });
  it('property: 1000 random 16-tile hands — tenpai iff winningTiles non-empty', () => {
    // build hands by shuffling NON_FLOWER kind pool with a simple LCG
    // (implementer: reuse engine mulberry32; draw 16 with max 4 copies per kind)
    // assert (shanten16(h,0)===0) === (winningTiles(h).length>0) and shanten16 >= -1
  });
});
```
(The property test body is required — write it with `mulberry32` from the engine; it is the main guard.)

- [ ] **Step 2: Run to verify fail.** — `pnpm install` then `pnpm -F @mahjong/bot test`, FAIL.

- [ ] **Step 3: Implement `shanten.ts`**

```ts
import { isWinningHand, kindIndex, NON_FLOWER_KINDS, type TileKind } from '@mahjong/engine';

/** Best decomposition search: maximize progress toward `need` sets + a pair. */
function search(
  counts: number[], i: number, need: number, sets: number, partials: number, pair: boolean,
): number {
  while (i < 34 && counts[i] === 0) i++;
  if (i === 34) {
    const usable = Math.min(partials, need - sets);
    return 2 * sets + usable + (pair ? 1 : 0);
  }
  let best = 0;
  const canRun = i < 27 && i % 9 <= 6;
  const canPartialRun = i < 27 && i % 9 <= 7;
  // pung
  if (counts[i]! >= 3 && sets < need) {
    counts[i]! -= 3;
    best = Math.max(best, search(counts, i, need, sets + 1, partials, pair));
    counts[i]! += 3;
  }
  // run
  if (canRun && counts[i + 1]! > 0 && counts[i + 2]! > 0 && sets < need) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    best = Math.max(best, search(counts, i, need, sets + 1, partials, pair));
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
  // pair (only one)
  if (!pair && counts[i]! >= 2) {
    counts[i]! -= 2;
    best = Math.max(best, search(counts, i, need, sets, partials, true));
    counts[i]! += 2;
  }
  // partial pung
  if (counts[i]! >= 2 && sets + partials < need) {
    counts[i]! -= 2;
    best = Math.max(best, search(counts, i, need, sets, partials + 1, pair));
    counts[i]! += 2;
  }
  // partial runs: (i,i+1) and (i,i+2)
  if (canPartialRun && counts[i + 1]! > 0 && sets + partials < need) {
    counts[i]!--; counts[i + 1]!--;
    best = Math.max(best, search(counts, i, need, sets, partials + 1, pair));
    counts[i]!++; counts[i + 1]!++;
  }
  if (canRun && counts[i + 2]! > 0 && sets + partials < need) {
    counts[i]!--; counts[i + 2]!--;
    best = Math.max(best, search(counts, i, need, sets, partials + 1, pair));
    counts[i]!++; counts[i + 2]!++;
  }
  // skip this tile
  const c = counts[i]!;
  counts[i] = 0;
  best = Math.max(best, search(counts, i + 1, need, sets, partials, pair));
  counts[i] = c;
  return best;
}

export function shanten16(concealed: TileKind[], meldCount: number): number {
  if (concealed.length % 3 === 2 && isWinningHand(concealed)) return -1;
  const need = 5 - meldCount;
  const counts = new Array<number>(34).fill(0);
  for (const t of concealed) counts[kindIndex(t)]!++;
  const progress = search(counts, 0, need, 0, 0, false);
  return Math.max(0, 2 * need + 1 - progress - 1); // target = 2*need sets-halves + pair
}
```

Note for the implementer: validate the formula against the tests, and if the property test finds a disagreement with `winningTiles`, trust `winningTiles` and adjust the final formula line — the search itself is standard.

- [ ] **Step 4: Run to verify pass** — including the 1000-hand property test. **Step 5: Commit** — `feat(bot): 16-tile shanten calculator`

---

### Task 3: Bot policy (`bot.ts`)

**Files:**
- Create: `packages/bot/src/bot.ts`, `packages/bot/src/index.ts` (exports)
- Test: `packages/bot/test/bot.test.ts`

**Interfaces:**
- Consumes: `PlayerView` (Task 1), `shanten16`, `mulberry32`.
- Produces: `chooseBotAction(view: PlayerView, rng?: () => number): Action` — always returns one of `view.legalActions` (throws if that list is empty). Policy:
  1. `self-win`/`claim win` if present — always.
  2. In `awaiting-discard`: for each legal discard, `shanten16(hand minus tile, melds.length)`; keep the discards with minimal shanten; tiebreak — prefer honors, then terminals (1/9), then pick via `rng` (default `mulberry32(1)`).
  3. Kong (concealed/added/claim): take only if shanten after the kong is ≤ shanten before.
  4. `claim pung`/`chow`: simulate the post-claim hand (remove used tiles; the claim obliges a follow-up discard — evaluate best discard shanten); claim only if it strictly reduces shanten; chow uses the best `chowTiles` option.
  5. Otherwise `pass`.

- [ ] **Step 1: Write the failing tests**

`packages/bot/test/bot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../src/bot.js';
import {
  applyAction, legalActions, mulberry32, newHand, viewFor, type Seat,
} from '@mahjong/engine';

describe('chooseBotAction', () => {
  it('always wins when winning is legal, and always returns a legal action', () => {
    // Drive 50 full games where all four seats are bots; assert every returned
    // action is in view.legalActions and every game terminates.
    const rng = mulberry32(99);
    for (let g = 0; g < 50; g++) {
      let s = newHand({ seed: g + 1, dealer: 0, dealerStreak: 0, roundWind: 'E' });
      let steps = 0;
      while (s.phase !== 'finished') {
        expect(++steps).toBeLessThan(1000);
        const seat = ([0, 1, 2, 3] as Seat[]).find((x) => legalActions(s, x).length > 0)!;
        const view = viewFor(s, seat);
        const action = chooseBotAction(view, rng);
        expect(view.legalActions).toContainEqual(action);
        if (view.legalActions.some((a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win'))) {
          expect(action.type === 'self-win' || (action.type === 'claim' && action.claim === 'win')).toBe(true);
        }
        s = applyAction(s, action);
      }
      expect(s.result).not.toBeNull();
    }
  });
  it('bots win more than random players do', () => {
    // Sanity strength check: across the 50 games above, count wins vs draw-exhausted;
    // expect at least 20% of hands to end in a win (random play rarely wins).
  });
});
```
(Second test body required — tally results in the same loop or a second loop.)

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `bot.ts`** per the policy contract. Key shape:

```ts
import { mulberry32, shanten16 /* via ./shanten.js */, ... } from ...;
import { isHonor, rankOf, type TileKind } from '@mahjong/engine';
import type { Action, PlayerView } from '@mahjong/engine';

export function chooseBotAction(view: PlayerView, rng: () => number = mulberry32(1)): Action {
  const acts = view.legalActions;
  if (acts.length === 0) throw new Error('bot has no legal actions');
  const win = acts.find((a) => a.type === 'self-win' || (a.type === 'claim' && a.claim === 'win'));
  if (win) return win;
  const discards = acts.filter((a): a is Extract<Action, { type: 'discard' }> => a.type === 'discard');
  if (discards.length > 0) return bestDiscard(view, discards, rng);
  return evaluateClaims(view, acts, rng); // per policy items 3–5, else pass
}
```
with `bestDiscard` / `evaluateClaims` as private functions implementing the shanten comparisons described above (each ≤ 30 lines).

- [ ] **Step 4: Run to verify pass** (both packages: `pnpm test` at root). **Step 5: Commit** — `feat(bot): shanten-driven bot policy`

---

### Task 4: Server package scaffold + health endpoint

**Files:**
- Create: `packages/server/package.json`, `tsconfig.json`, `src/app.config.ts`, `src/index.ts`, `src/TableRoom.ts` (empty room class), `test/health.test.ts`

**Interfaces:**
- Produces: `appConfig` (default export of `app.config.ts`) — used by `index.ts` (`listen(appConfig)`) and by every test via `boot(appConfig)`. Room type name: `'table'`.

`packages/server/package.json`:
```json
{
  "name": "@mahjong/server", "version": "0.1.0", "private": true, "type": "module",
  "main": "src/index.ts",
  "scripts": { "dev": "tsx watch src/index.ts", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@colyseus/core": "^0.16.0", "@colyseus/tools": "^0.16.0", "@colyseus/ws-transport": "^0.16.0",
    "@mahjong/bot": "workspace:*", "@mahjong/engine": "workspace:*"
  },
  "devDependencies": {
    "@colyseus/testing": "^0.16.0", "colyseus.js": "^0.16.0",
    "tsx": "^4.16.0", "typescript": "^5.5.0", "vitest": "^2.0.0"
  }
}
```

`src/app.config.ts`:
```ts
import config from '@colyseus/tools';
import { TableRoom } from './TableRoom.js';

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('table', TableRoom);
  },
  initializeExpress: (app) => {
    app.get('/health', (_req, res) => res.json({ ok: true }));
  },
});
```

`src/index.ts`:
```ts
import { listen } from '@colyseus/tools';
import appConfig from './app.config.js';

listen(appConfig, Number(process.env.PORT ?? 2567));
```

`test/health.test.ts` boots via `@colyseus/testing`'s `boot(appConfig)`, fetches `/health`, expects `{ ok: true }`, shuts down in `afterAll`.

- [ ] Steps: write test → fail → implement → pass → commit `chore(server): colyseus scaffold with health endpoint`.

**Version-check note for the implementer:** pin whatever 0.16.x resolves at install; if `@colyseus/tools`' `config`/`listen` signatures changed, adapt `app.config.ts` to the installed version's documented shape — the tests, not this snippet, are the contract.

---

### Task 5: Room codes + lobby (join, seats, config, bots, host)

**Files:**
- Create: `src/roomCode.ts`; Modify: `src/TableRoom.ts`
- Test: `test/roomCode.test.ts`, `test/lobby.test.ts`

**Interfaces:**
- `roomCode.ts` produces: `generateRoomCode(rng?: () => number): string` — 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1).
- **Wire protocol (frozen; client→server unless noted):**

| Message | Payload | Meaning |
|---|---|---|
| join options | `{ playerId: string; name: string }` | on `client.joinById(code, options)` / `create` |
| `config` | `{ totalRounds?: 1\|2\|4; base?: number; perTai?: number; turnSeconds?: number; claimSeconds?: number }` | host only, lobby only |
| `fill-bot` / `remove-bot` | `{ seat: Seat }` | host only, lobby only |
| `start` | `{}` | host only; requires 4 filled seats |
| `lobby` (server→all) | `{ code: string; hostPlayerId: string; config: RoomConfig; seats: SeatPublic[] }` where `SeatPublic = { seat: Seat; kind: 'human'\|'bot'\|'empty'; name: string\|null; connected: boolean }` | after every lobby change |
| `error` (server→one) | `{ message: string }` | rejected message |

- Room internals produced for later tasks: `seats: SeatInternal[]` (`{ kind, playerId, name, connected, client }`), `config: RoomConfig`, `hostPlayerId`. `onCreate` sets `this.roomId = generateRoomCode()` (retry up to 5× on `matchMaker` collision) and `maxClients = 4`. `onJoin`: same `playerId` → reattach to its seat (sets `connected = true`); else first `empty` seat; room full → throw (Colyseus rejects the join). First human to join is host; if the host leaves in lobby, host passes to the next connected human.

- [ ] **Step 1: Write the failing tests** — `roomCode.test.ts` (length 6, alphabet only, deterministic with injected rng, ~no collisions in 10k draws) and `lobby.test.ts` using `@colyseus/testing`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../src/app.config.js';

let env: ColyseusTestServer;
beforeAll(async () => { env = await boot(appConfig); });
afterAll(async () => { await env.shutdown(); });

describe('lobby', () => {
  it('host creates, friends join by code, seats fill in order', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const code = host.roomId;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const lobby1 = await nextMessage(host, 'lobby');
    expect(lobby1.seats[0]).toMatchObject({ kind: 'human', name: 'Ann' });

    const friend = await env.sdk.joinById(code, { playerId: 'p2', name: 'Bo' });
    const lobby2 = await nextMessage(friend, 'lobby');
    expect(lobby2.seats[1]).toMatchObject({ kind: 'human', name: 'Bo' });
    expect(lobby2.hostPlayerId).toBe('p1');
  });
  it('host fills bots and starts only with 4 seats filled', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    host.send('start', {});
    expect((await nextMessage(host, 'error')).message).toMatch(/4 seats/);
    host.send('fill-bot', { seat: 1 });
    host.send('fill-bot', { seat: 2 });
    host.send('fill-bot', { seat: 3 });
    const lobby = await messageWhere(host, 'lobby', (m) => m.seats.every((s: any) => s.kind !== 'empty'));
    expect(lobby.seats.filter((s: any) => s.kind === 'bot')).toHaveLength(3);
  });
  it('non-host cannot configure or start', async () => {
    const host = await env.sdk.create('table', { playerId: 'p1', name: 'Ann' });
    const friend = await env.sdk.joinById(host.roomId, { playerId: 'p2', name: 'Bo' });
    friend.send('start', {});
    expect((await nextMessage(friend, 'error')).message).toMatch(/host/);
  });
});
```
Include the small `nextMessage(client, type)` / `messageWhere(client, type, pred)` promise helpers in a shared `test/util.ts` (wrap `client.onMessage(type, ...)` with a timeout).

- [ ] **Step 2: fail** → **Step 3: implement** `TableRoom` lobby logic per the contract (all handlers registered in `onCreate`; every mutation ends with `broadcastLobby()`). → **Step 4: pass** → **Step 5: commit** `feat(server): rooms with join codes, seats, bots, host controls`.

---### Task 6: Game flow over the wire — start, views, actions

**Files:**
- Modify: `src/TableRoom.ts`
- Test: `test/gameflow.test.ts`

**Interfaces:**
- **Wire protocol additions (frozen):**

| Message | Payload | Meaning |
|---|---|---|
| `view` (server→one) | `PlayerView` | sent to each seated human after every state transition |
| `action` | `{ action: Action }` | player plays; server validates seat ownership (`action.seat` must be the sender's seat) then `applyAction` |
| `hand-result` (server→all) | `{ result: HandResult; scores: [number, number, number, number] }` | when a hand finishes (`scores` = running session totals) |
| `emote` | `{ emote: string }` → rebroadcast as `{ seat: Seat; emote: string }` | pass-through, rate-limited 1/sec/seat |

- Room internals: `game: GameState | null`, `generation: number` (incremented on every transition; stale bot timers check it), `session: SessionParams`, `scores: [number, number, number, number]`. `startHand()` builds `newHand({ seed: crypto.randomInt(2 ** 31), ...session, rules: config })` and `pushViews()`. `act(seat, action)`: `try { this.game = applyAction(this.game, action) } catch (e) { send error; return }`; `generation++`; if `phase === 'finished'` → apply payments to `scores`, broadcast `hand-result`, schedule next hand (Task 9 wires session end); else `pushViews()`.
- `IllegalActionError` → `error` message to the sender **and a fresh `view`** (client resyncs); any other exception → rethrow (server bug, crash loudly in dev).

- [ ] **Step 1: failing tests** — with 1 human + 3 bots *disabled* (this task tests humans only: use 4 human clients):

```ts
it('4 humans play a full hand over the wire', async () => {
  // create + join 4 clients; host start; then loop:
  //   collect latest 'view' per client; find the client whose view.legalActions is non-empty;
  //   send its first legalAction as {action}; repeat until 'hand-result' arrives (cap 600 iterations).
  // Asserts en route:
  //   - every received view: no opponent.hand key, wallCount is a number
  //   - a client sending an action for a seat it doesn't own gets 'error'
  //   - hand-result.scores sum to 0
});
```
Write it concretely with the Task 5 helpers (latest-view tracking = subscribe once per client, store in a map).

- [ ] **Step 2: fail** → **Step 3: implement** per contract → **Step 4: pass** → **Step 5: commit** `feat(server): authoritative game flow with per-seat views`.

---

### Task 7: Bot seats play

**Files:**
- Modify: `src/TableRoom.ts`
- Test: `test/bots.test.ts`

**Interfaces:**
- Consumes: `chooseBotAction` from `@mahjong/bot`.
- Produces: after every `pushViews()`, `scheduleBots()`: for each seat where (`kind === 'bot'`) or (`kind === 'human' && !connected`), if `legalActions(game, seat)` non-empty → `this.clock.setTimeout(() => { if (gen === this.generation) this.act(seat, chooseBotAction(viewFor(this.game!, seat))) }, config.botDelayMs)`. The generation guard prevents stale bot moves.

- [ ] **Step 1: failing test** — host + 3 bots, `botDelayMs: 0` via a test-only config override in join options (`{ __test: { botDelayMs: 0, turnSeconds: 0 } }` honored only when `process.env.NODE_ENV === 'test'`):

```ts
it('1 human + 3 bots complete a hand; bots act without human input', async () => {
  // host creates, fills 3 bots, starts; human always plays its first legalAction
  // when its view shows any; expect 'hand-result' within a bounded loop.
});
it('4 bots... (host disconnects pre-start is Task 8; here: human plays minimally)', ...);
```

- [ ] **Steps 2–5:** fail → implement → pass → commit `feat(server): bot seats driven by the bot policy`.

---

### Task 8: Timers and disconnect takeover

**Files:**
- Modify: `src/TableRoom.ts`
- Test: `test/timers.test.ts`, `test/reconnect.test.ts`

**Interfaces (behavior):**
- **Turn timer:** entering `awaiting-discard` arms `turnSeconds` for the turn seat (humans only); on expiry the server plays `chooseBotAction` for that seat. **Claim timer:** entering `awaiting-claims` arms `claimSeconds` per unresponded human claimant; expiry sends `pass` for them. All timers use `this.clock` and are cancelled on `generation` change.
- **Disconnect (`onLeave`):** seat keeps `kind: 'human'`, sets `connected: false` → covered by Task 7's scheduling rule, so a bot immediately plays for them mid-hand. In lobby, a disconnected non-host seat is freed (`empty`); a disconnected host in lobby passes host + frees seat.
- **Reconnect:** `joinById` with the same `playerId` reattaches (Task 5 already routes this); on reattach mid-game the room sends the current `view` immediately. `allowReconnection` is NOT used — seat mapping is by `playerId`, simpler and survives server-side client object loss.
- New server→client message: `seat-status` broadcast `{ seat: Seat; connected: boolean }` on any connect/disconnect during a game (the app shows a "bot is covering" badge).

- [ ] **Step 1: failing tests** — `timers.test.ts`: with `turnSeconds: 1, claimSeconds: 1` (test override) and a human who never responds, assert the game still reaches `hand-result`. Use `room.clock` manipulation if `@colyseus/testing` exposes it; otherwise real 1s timers with a generous vitest timeout. `reconnect.test.ts`: start 2 humans + 2 bots; `client.leave(false)` one human mid-hand; assert `seat-status {connected:false}` and that the game continues; rejoin with the same `playerId`; assert a `view` arrives with `seat` preserved and `seat-status {connected:true}`.

- [ ] **Steps 2–5:** fail → implement → pass → commit `feat(server): turn/claim timers and disconnect takeover with rejoin`.

---

### Task 9: Session loop, standings, play-again + server README

**Files:**
- Modify: `src/TableRoom.ts`; Create: `packages/server/README.md`
- Test: `test/session.test.ts`

**Interfaces:**
- Consumes: `nextHandParams`, `isSessionOver`.
- Produces: after `hand-result`, if `isSessionOver(next, config.totalRounds)` → broadcast `session-end` `{ standings: { seat: Seat; name: string; score: number }[] }` (sorted desc) and return to lobby state (seats kept, `game = null`) so the host can reconfigure and `start` again; else `startHand()` with the advanced `SessionParams` after a 5s (config `interHandMs`) pause.
- README documents: the full wire protocol table (Tasks 5, 6, 8, 9 rows merged), join flow, test-override options, and the invariant "clients only ever see PlayerView". This README is Plan 3's contract document.

- [ ] **Step 1: failing test** — `totalRounds: 1` with fast bots: 1 human (auto-playing first legal action) + 3 bots; count `hand-result` messages until `session-end`; assert ≥ 4 hands played (a full E round rotates the deal through 4 seats, plus dealer-repeat hands), standings sorted and consistent with summed results.

- [ ] **Steps 2–5:** fail → implement → pass → write README → commit `feat(server): multi-hand sessions with standings and play-again`.

---

### Task 10: Full-stack soak test + dev script

**Files:**
- Create: `test/soak.test.ts`, root `package.json` script `"dev:server": "pnpm -F @mahjong/server dev"`

- [ ] **Step 1:** Soak test: boot, run **3 rooms concurrently**, each 1 human-driver + 3 bots with `botDelayMs: 0`, `totalRounds: 1`, to `session-end`. Asserts: no unhandled rejections (fail the test on `process.on('unhandledRejection')` during the run), every message received parses as its documented shape, rooms don't cross-talk (a client never receives a view whose `seat`/room it doesn't own).
- [ ] **Step 2:** Run full repo suite `pnpm test` + `pnpm typecheck` — all green.
- [ ] **Step 3:** Manual checkpoint: `pnpm dev:server`, open `http://localhost:2567/health`, confirm `{ok:true}`. Colyseus playground (if bundled) may be used to poke a room.
- [ ] **Step 4: Commit** — `test(server): multi-room soak test; dev script`

---

## Self-Review (completed at authoring time)

- **Spec coverage:** authoritative filtered state (T1, enforced in T6 assertions), rooms with code+link joining (T5), turn flow + claim windows with timers (T8), bots filling seats and covering disconnects with seamless rejoin (T7–T8), ephemeral rooms/no DB (nothing persisted), session scoring + play-again (T9). Deep links themselves are app-side (Plan 3) — the server only needs codes, present in T5.
- **Placeholders:** two test bodies are specified by contract with required content named (shanten property test, bot strength test) — each states exactly what to build; no TBDs.
- **Type consistency:** `PlayerView` defined once (T1) and consumed by bot (T3), room (T6), tests; wire protocol tables are the single naming source; `SeatPublic` vs `SeatInternal` distinguished in T5.
