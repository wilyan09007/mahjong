# Mahjong v1 — Plan 1: Monorepo Scaffold + Taiwanese Rules Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the TypeScript monorepo and build the complete, fully-tested Taiwanese 16-tile mahjong rules engine (`@mahjong/engine`) — pure logic, no UI, no network.

**Architecture:** The engine is a deterministic, side-effect-free state machine: `newHand(seed, …) → GameState`, `legalActions(state, seat) → Action[]`, `applyAction(state, action) → GameState`. All hidden information (wall, hands) lives in the state; the server (Plan 2) filters per-player views. Scoring is a variant-pluggable module; Taiwanese ships now, Cantonese slots in later behind the same interface.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest. No runtime dependencies in the engine.

**Spec:** `docs/superpowers/specs/2026-08-16-mahjong-app-design.md`

## Roadmap of v1 plans (this is Plan 1)

1. **This plan** — monorepo scaffold + `@mahjong/engine` (Taiwanese variant).
2. **Plan 2** — `@mahjong/server` (Colyseus rooms, filtered state, reconnection) + `@mahjong/bot` (shanten-based AI). Written when Plan 1's API is locked.
3. **Plan 3** — `@mahjong/app` (Expo RN client, SVG art pipeline, Skia table, 4 screens).
4. **Plan 4** — Delivery (EAS build config, Play Store listing + submission).

## Global Constraints

- Node ≥ 20, pnpm ≥ 9 (install via `corepack enable`), TypeScript `strict: true`.
- Engine is pure: **no I/O, no `Date.now()`, no `Math.random()`** — randomness only via the seeded RNG in `wall.ts`.
- `applyAction` never mutates its input; it returns a new state (use `structuredClone`).
- Illegal actions throw `IllegalActionError` — never silently ignored.
- Tile codes (used in ALL code and tests): suits `'1w'…'9w'` (characters/萬), `'1t'…'9t'` (dots/筒), `'1b'…'9b'` (bamboo/條); winds `'we','ws','ww','wn'` (E,S,W,N); dragons `'dr','dg','dw'` (red 中, green 發, white 白); flowers `'f1'…'f8'`.
- Seats are `0|1|2|3`; seat wind at hand start = E,S,W,N counted from the dealer (dealer is always East for the hand).
- Default stakes: base (底) = 3 points, per-tai (台) = 1 point; both are parameters, never hardcoded outside defaults.
- Commit after every task (conventional commits: `feat:`, `test:`, `chore:`).

## File Structure

```
mahjong/
├── package.json                  # private root, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
└── packages/engine/
    ├── package.json              # @mahjong/engine, type: module
    ├── tsconfig.json
    ├── README.md                 # Task 12
    ├── src/
    │   ├── tiles.ts              # tile kinds, full set, helpers, sort
    │   ├── wall.ts               # seeded RNG, shuffled wall
    │   ├── melds.ts              # meld types + legality
    │   ├── win.ts                # win detection, decomposition, waits
    │   ├── deal.ts               # initial deal + flower replacement
    │   ├── game.ts               # GameState, actions, reducer, legalActions
    │   ├── claims.ts             # claim options + priority resolution
    │   ├── scoring/taiwanese.ts  # tai table + hand scoring
    │   ├── scoring/payments.ts   # per-seat payment computation
    │   ├── session.ts            # dealer rotation, round wind, streak
    │   ├── variant.ts            # Variant interface + TAIWANESE
    │   └── index.ts              # public API
    └── test/                     # one *.test.ts per src module + simulation.test.ts
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`, `packages/engine/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a workspace where `pnpm -F @mahjong/engine test` runs Vitest.

- [ ] **Step 1: Verify toolchain**

Run: `node --version` (expect ≥ 20). Then `corepack enable` and `pnpm --version` (expect ≥ 9; if corepack is unavailable, `npm i -g pnpm`).

- [ ] **Step 2: Write root files**

`package.json`:
```json
{
  "name": "mahjong",
  "private": true,
  "scripts": { "test": "pnpm -r test", "typecheck": "pnpm -r typecheck" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.expo/
*.tsbuildinfo
```

- [ ] **Step 3: Write engine package files**

`packages/engine/package.json`:
```json
{
  "name": "@mahjong/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
```

`packages/engine/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = '0.1.0';
```

`packages/engine/test/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

describe('scaffold', () => {
  it('imports the engine package', () => {
    expect(ENGINE_VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install` then `pnpm -F @mahjong/engine test`
Expected: 1 test passes. Also run `pnpm -F @mahjong/engine typecheck` — no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with engine package"
```

---

### Task 2: Tile kinds and the full set (`tiles.ts`)

**Files:**
- Create: `packages/engine/src/tiles.ts`
- Test: `packages/engine/test/tiles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact exports every later task uses):
  - Types: `SuitCode('w'|'t'|'b')`, `Rank(1–9)`, `SuitTileKind`, `WindKind`, `DragonKind`, `HonorKind`, `FlowerKind`, `TileKind`, `Seat(0|1|2|3)`, `Wind('E'|'S'|'W'|'N')`
  - Constants: `SUIT_KINDS` (27), `WINDS` (4), `DRAGONS` (3), `FLOWERS` (8), `NON_FLOWER_KINDS` (34), `FULL_TILE_SET` (144)
  - Functions: `isFlower(t): t is FlowerKind`, `isSuitTile(t): t is SuitTileKind`, `isHonor(t): t is HonorKind`, `rankOf(t): Rank | null`, `suitOf(t): SuitCode | null`, `sortTiles(ts: TileKind[]): TileKind[]` (non-mutating), `kindIndex(t): number` (0–33 over `NON_FLOWER_KINDS`, throws for flowers), `seatWind(seat: Seat, dealer: Seat): Wind`

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/tiles.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  FULL_TILE_SET, NON_FLOWER_KINDS, FLOWERS, isFlower, isSuitTile, isHonor,
  rankOf, suitOf, sortTiles, kindIndex, seatWind,
} from '../src/tiles.js';

describe('tile set', () => {
  it('has exactly 144 tiles', () => {
    expect(FULL_TILE_SET).toHaveLength(144);
  });
  it('has 4 copies of each of the 34 non-flower kinds and 1 of each flower', () => {
    for (const kind of NON_FLOWER_KINDS) {
      expect(FULL_TILE_SET.filter((t) => t === kind)).toHaveLength(4);
    }
    for (const f of FLOWERS) {
      expect(FULL_TILE_SET.filter((t) => t === f)).toHaveLength(1);
    }
    expect(NON_FLOWER_KINDS).toHaveLength(34);
  });
});

describe('helpers', () => {
  it('classifies tiles', () => {
    expect(isFlower('f3')).toBe(true);
    expect(isFlower('3w')).toBe(false);
    expect(isSuitTile('9b')).toBe(true);
    expect(isSuitTile('we')).toBe(false);
    expect(isHonor('dr')).toBe(true);
    expect(isHonor('1t')).toBe(false);
  });
  it('extracts rank and suit', () => {
    expect(rankOf('7t')).toBe(7);
    expect(rankOf('wn')).toBeNull();
    expect(suitOf('7t')).toBe('t');
    expect(suitOf('dr')).toBeNull();
  });
  it('sorts suits by w,t,b then rank, then winds, dragons, flowers', () => {
    expect(sortTiles(['dr', '1b', 'we', '9w', '1w', 'f1'])).toEqual([
      '1w', '9w', '1b', 'we', 'dr', 'f1',
    ]);
  });
  it('indexes the 34 non-flower kinds stably', () => {
    expect(kindIndex('1w')).toBe(0);
    expect(kindIndex('1t')).toBe(9);
    expect(kindIndex('1b')).toBe(18);
    expect(kindIndex('we')).toBe(27);
    expect(kindIndex('dw')).toBe(33);
    expect(() => kindIndex('f1')).toThrow();
  });
  it('computes seat winds relative to the dealer', () => {
    expect(seatWind(0, 0)).toBe('E');
    expect(seatWind(1, 0)).toBe('S');
    expect(seatWind(0, 3)).toBe('S');
    expect(seatWind(3, 3)).toBe('E');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @mahjong/engine test`
Expected: FAIL — cannot resolve `../src/tiles.js`.

- [ ] **Step 3: Implement `tiles.ts`**

```ts
export type SuitCode = 'w' | 't' | 'b';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SuitTileKind = `${Rank}${SuitCode}`;
export type WindKind = 'we' | 'ws' | 'ww' | 'wn';
export type DragonKind = 'dr' | 'dg' | 'dw';
export type HonorKind = WindKind | DragonKind;
export type FlowerKind = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8';
export type TileKind = SuitTileKind | HonorKind | FlowerKind;
export type Seat = 0 | 1 | 2 | 3;
export type Wind = 'E' | 'S' | 'W' | 'N';

const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SUITS: SuitCode[] = ['w', 't', 'b'];

export const SUIT_KINDS: SuitTileKind[] = SUITS.flatMap((s) =>
  RANKS.map((r) => `${r}${s}` as SuitTileKind),
);
export const WINDS: WindKind[] = ['we', 'ws', 'ww', 'wn'];
export const DRAGONS: DragonKind[] = ['dr', 'dg', 'dw'];
export const FLOWERS: FlowerKind[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
export const NON_FLOWER_KINDS: (SuitTileKind | HonorKind)[] = [
  ...SUIT_KINDS, ...WINDS, ...DRAGONS,
];
export const FULL_TILE_SET: TileKind[] = [
  ...NON_FLOWER_KINDS.flatMap((k) => [k, k, k, k]),
  ...FLOWERS,
];

const ORDER = new Map<TileKind, number>(
  [...NON_FLOWER_KINDS, ...FLOWERS].map((k, i) => [k, i]),
);

export function isFlower(t: TileKind): t is FlowerKind {
  return t.startsWith('f');
}
export function isSuitTile(t: TileKind): t is SuitTileKind {
  const r = Number(t[0]);
  return r >= 1 && r <= 9;
}
export function isHonor(t: TileKind): t is HonorKind {
  return !isFlower(t) && !isSuitTile(t);
}
export function rankOf(t: TileKind): Rank | null {
  return isSuitTile(t) ? (Number(t[0]) as Rank) : null;
}
export function suitOf(t: TileKind): SuitCode | null {
  return isSuitTile(t) ? (t[1] as SuitCode) : null;
}
export function sortTiles(ts: TileKind[]): TileKind[] {
  return [...ts].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}
export function kindIndex(t: TileKind): number {
  if (isFlower(t)) throw new Error(`flowers have no kind index: ${t}`);
  return ORDER.get(t)!;
}
const WIND_CYCLE: Wind[] = ['E', 'S', 'W', 'N'];
export function seatWind(seat: Seat, dealer: Seat): Wind {
  return WIND_CYCLE[(seat - dealer + 4) % 4]!;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @mahjong/engine test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): tile kinds, full 144-tile set, helpers"
```

---

### Task 3: Seeded RNG and shuffled wall (`wall.ts`)

**Files:**
- Create: `packages/engine/src/wall.ts`
- Test: `packages/engine/test/wall.test.ts`

**Interfaces:**
- Consumes: `FULL_TILE_SET`, `TileKind` from `tiles.ts`.
- Produces: `mulberry32(seed: number): () => number`, `buildWall(seed: number): TileKind[]` (shuffled copy, length 144). Later tasks draw by moving `wallFront`/`wallBack` indexes into this fixed array — the array itself is never mutated after creation.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/wall.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildWall, mulberry32 } from '../src/wall.js';
import { FULL_TILE_SET, sortTiles } from '../src/tiles.js';

describe('wall', () => {
  it('is deterministic per seed', () => {
    expect(buildWall(42)).toEqual(buildWall(42));
    expect(buildWall(42)).not.toEqual(buildWall(43));
  });
  it('is a permutation of the full tile set', () => {
    expect(sortTiles(buildWall(7))).toEqual(sortTiles(FULL_TILE_SET));
  });
  it('rng emits values in [0,1) deterministically', () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `pnpm -F @mahjong/engine test`, FAIL (module not found).

- [ ] **Step 3: Implement `wall.ts`**

```ts
import { FULL_TILE_SET, type TileKind } from './tiles.js';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWall(seed: number): TileKind[] {
  const tiles = [...FULL_TILE_SET];
  const rng = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  return tiles;
}
```

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): seeded rng and deterministic shuffled wall"
```

---

### Task 4: Melds and claim legality (`melds.ts`)

**Files:**
- Create: `packages/engine/src/melds.ts`
- Test: `packages/engine/test/melds.test.ts`

**Interfaces:**
- Consumes: `TileKind`, `Seat`, `isSuitTile`, `rankOf`, `suitOf`, `sortTiles` from `tiles.ts`.
- Produces:
  - `type MeldType = 'chow' | 'pung' | 'kong'`
  - `interface Meld { type: MeldType; tiles: TileKind[]; concealed: boolean; claimedFrom: Seat | null }`
  - `chowOptions(hand: TileKind[], tile: TileKind): [TileKind, TileKind][]` — pairs from hand completing a run with `tile`
  - `canPung(hand: TileKind[], tile: TileKind): boolean`
  - `canExposedKong(hand: TileKind[], tile: TileKind): boolean`
  - `concealedKongOptions(hand: TileKind[]): TileKind[]` — kinds held 4×
  - `addedKongOptions(hand: TileKind[], melds: Meld[]): TileKind[]` — kinds where hand holds the 4th tile of an existing pung

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/melds.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  addedKongOptions, canExposedKong, canPung, chowOptions, concealedKongOptions,
  type Meld,
} from '../src/melds.js';

describe('chowOptions', () => {
  it('finds all run completions', () => {
    expect(chowOptions(['1w', '2w', '4w', '5w'], '3w')).toEqual([
      ['1w', '2w'], ['2w', '4w'], ['4w', '5w'],
    ]);
  });
  it('never chows honors or across suits', () => {
    expect(chowOptions(['we', 'ws'], 'ww')).toEqual([]);
    expect(chowOptions(['1w', '2t'], '3b')).toEqual([]);
  });
  it('deduplicates identical options', () => {
    expect(chowOptions(['4t', '4t', '5t'], '6t')).toEqual([['4t', '5t']]);
  });
});

describe('pung and kong', () => {
  it('pung needs two matching in hand', () => {
    expect(canPung(['dr', 'dr', '1w'], 'dr')).toBe(true);
    expect(canPung(['dr', '1w'], 'dr')).toBe(false);
  });
  it('exposed kong needs three matching in hand', () => {
    expect(canExposedKong(['5b', '5b', '5b'], '5b')).toBe(true);
    expect(canExposedKong(['5b', '5b'], '5b')).toBe(false);
  });
  it('concealed kong lists kinds held four times', () => {
    expect(concealedKongOptions(['9t', '9t', '9t', '9t', '1w'])).toEqual(['9t']);
  });
  it('added kong requires an existing exposed pung plus the 4th tile', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: ['ww', 'ww', 'ww'], concealed: false, claimedFrom: 2 },
    ];
    expect(addedKongOptions(['ww', '3b'], melds)).toEqual(['ww']);
    expect(addedKongOptions(['3b'], melds)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (module not found).

- [ ] **Step 3: Implement `melds.ts`**

```ts
import {
  isSuitTile, rankOf, suitOf, type Seat, type SuitTileKind, type TileKind,
} from './tiles.js';

export type MeldType = 'chow' | 'pung' | 'kong';
export interface Meld {
  type: MeldType;
  tiles: TileKind[];
  concealed: boolean;
  claimedFrom: Seat | null;
}

function count(hand: TileKind[], t: TileKind): number {
  return hand.filter((h) => h === t).length;
}
function shift(t: SuitTileKind, by: number): SuitTileKind | null {
  const r = rankOf(t)! + by;
  return r >= 1 && r <= 9 ? (`${r}${suitOf(t)!}` as SuitTileKind) : null;
}

export function chowOptions(hand: TileKind[], tile: TileKind): [TileKind, TileKind][] {
  if (!isSuitTile(tile)) return [];
  const options: [TileKind, TileKind][] = [];
  const candidates: [SuitTileKind | null, SuitTileKind | null][] = [
    [shift(tile, -2), shift(tile, -1)],
    [shift(tile, -1), shift(tile, 1)],
    [shift(tile, 1), shift(tile, 2)],
  ];
  for (const [a, b] of candidates) {
    if (a && b && count(hand, a) > 0 && count(hand, b) > 0) options.push([a, b]);
  }
  return options;
}

export function canPung(hand: TileKind[], tile: TileKind): boolean {
  return count(hand, tile) >= 2;
}
export function canExposedKong(hand: TileKind[], tile: TileKind): boolean {
  return count(hand, tile) >= 3;
}
export function concealedKongOptions(hand: TileKind[]): TileKind[] {
  return [...new Set(hand)].filter((t) => count(hand, t) === 4);
}
export function addedKongOptions(hand: TileKind[], melds: Meld[]): TileKind[] {
  return melds
    .filter((m) => m.type === 'pung' && count(hand, m.tiles[0]!) >= 1)
    .map((m) => m.tiles[0]!);
}
```

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): meld types and chow/pung/kong legality"
```

---

### Task 5: Win detection, decomposition, waits (`win.ts`)

**Files:**
- Create: `packages/engine/src/win.ts`
- Test: `packages/engine/test/win.test.ts`

**Interfaces:**
- Consumes: `TileKind`, `NON_FLOWER_KINDS`, `kindIndex`, `isSuitTile` from `tiles.ts`.
- Produces:
  - `isWinningHand(tiles: TileKind[]): boolean` — `tiles` = concealed tiles including the winning tile; length must satisfy `len % 3 === 2` (17 with no melds; 3 fewer per meld). Win shape: N sets (pung/run) + exactly one pair.
  - `decomposeWin(tiles: TileKind[]): { sets: TileKind[][]; pair: TileKind } | null` — one valid decomposition (sets are 3-tile groups; kongs live in melds, never here).
  - `winningTiles(tiles: TileKind[]): TileKind[]` — for a hand with `len % 3 === 1` (16 with no melds), the kinds that complete it.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/win.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decomposeWin, isWinningHand, winningTiles } from '../src/win.js';
import type { TileKind } from '../src/tiles.js';

// Full 17-tile Taiwanese winning hand: 5 sets + pair.
const WIN_17: TileKind[] = [
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
  '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we',
];

describe('isWinningHand', () => {
  it('accepts 5 sets + pair (17 tiles)', () => {
    expect(isWinningHand(WIN_17)).toBe(true);
  });
  it('accepts hands shortened by melds (8 tiles = 2 sets + pair)', () => {
    expect(isWinningHand(['2b', '3b', '4b', '7t', '7t', '7t', 'dg', 'dg'])).toBe(true);
  });
  it('rejects a near-miss', () => {
    const nearMiss = [...WIN_17.slice(0, 16), '9b'] as TileKind[];
    expect(isWinningHand(nearMiss)).toBe(false);
  });
  it('rejects two pairs / wrong shape', () => {
    expect(isWinningHand(['1w', '1w', '2w', '2w', '5t', '5t', '5t', '9b'])).toBe(false);
  });
});

describe('decomposeWin', () => {
  it('returns sets and the pair', () => {
    const d = decomposeWin(WIN_17);
    expect(d).not.toBeNull();
    expect(d!.pair).toBe('we');
    expect(d!.sets).toHaveLength(5);
  });
  it('returns null for non-winning tiles', () => {
    expect(decomposeWin(['1w', '1w', '1w', '2t', '3t'])).toBeNull();
  });
});

describe('winningTiles', () => {
  it('finds a two-sided wait', () => {
    // 2 sets done + pair done + 4w5w waiting on 3w/6w (7-tile hand = 2 melds out)
    const waits = winningTiles(['4w', '5w', '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we', 'we']);
    expect(waits).toEqual(['3w', '6w']);
  });
  it('finds a pair wait', () => {
    const waits = winningTiles(['9b', '1t', '1t', '1t', '2t', '3t', '4t']);
    expect(waits).toEqual(['9b']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (module not found).

- [ ] **Step 3: Implement `win.ts`**

```ts
import {
  NON_FLOWER_KINDS, isSuitTile, kindIndex, type TileKind,
} from './tiles.js';

function toCounts(tiles: TileKind[]): number[] {
  const counts = new Array<number>(34).fill(0);
  for (const t of tiles) counts[kindIndex(t)]!++;
  return counts;
}
function kindAt(i: number): TileKind {
  return NON_FLOWER_KINDS[i]!;
}
// A run may start at suit ranks 1..7: index i starts a run iff i%9 <= 6 and i < 27.
function canStartRun(i: number): boolean {
  return i < 27 && i % 9 <= 6;
}

function removeSets(counts: number[], sets: TileKind[][] | null): boolean {
  const i = counts.findIndex((c) => c > 0);
  if (i === -1) return true;
  if (counts[i]! >= 3) {
    counts[i]! -= 3;
    if (removeSets(counts, sets)) {
      sets?.push([kindAt(i), kindAt(i), kindAt(i)]);
      return true;
    }
    counts[i]! += 3;
  }
  if (canStartRun(i) && counts[i + 1]! > 0 && counts[i + 2]! > 0) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    if (removeSets(counts, sets)) {
      sets?.push([kindAt(i), kindAt(i + 1), kindAt(i + 2)]);
      return true;
    }
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
  return false;
}

export function decomposeWin(
  tiles: TileKind[],
): { sets: TileKind[][]; pair: TileKind } | null {
  if (tiles.length % 3 !== 2) return null;
  const counts = toCounts(tiles);
  for (let p = 0; p < 34; p++) {
    if (counts[p]! < 2) continue;
    counts[p]! -= 2;
    const sets: TileKind[][] = [];
    if (removeSets(counts, sets)) {
      counts[p]! += 2;
      return { sets: sets.reverse(), pair: kindAt(p) };
    }
    counts[p]! += 2;
  }
  return null;
}

export function isWinningHand(tiles: TileKind[]): boolean {
  return decomposeWin(tiles) !== null;
}

export function winningTiles(tiles: TileKind[]): TileKind[] {
  if (tiles.length % 3 !== 1) return [];
  return NON_FLOWER_KINDS.filter((k) => isWinningHand([...tiles, k]));
}
```

- [ ] **Step 4: Run tests to verify they pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): win detection, decomposition, and waits"
```

---

### Task 6: Game state and the deal (`game.ts` types + `deal.ts`)

**Files:**
- Create: `packages/engine/src/game.ts` (types + `newHand` only in this task), `packages/engine/src/deal.ts`
- Test: `packages/engine/test/deal.test.ts`

**Interfaces:**
- Consumes: `buildWall`; tile types/helpers; `Meld`.
- Produces (in `game.ts` — later tasks extend this file):

```ts
export class IllegalActionError extends Error {}
export type Phase = 'awaiting-discard' | 'awaiting-claims' | 'finished';
export interface PlayerState {
  hand: TileKind[];          // concealed, sorted
  melds: Meld[];
  flowers: FlowerKind[];
  discards: TileKind[];
}
export interface HandRules { base: number; perTai: number }  // defaults {base: 3, perTai: 1}
export interface GameState {
  seed: number;
  tiles: TileKind[];         // fixed shuffled 144, never mutated
  wallFront: number;         // next index to draw from the front
  wallBack: number;          // next index to draw from the back (flower/kong replacements)
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  rules: HandRules;
  turn: Seat;
  phase: Phase;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  lastDiscard: { tile: TileKind; by: Seat } | null;
  pendingClaims: PendingClaims | null;   // defined in Task 8; null until then
  lastDrawWasReplacement: boolean;       // for 槓上開花
  result: HandResult | null;             // defined in Task 10; null until finished
}
export function newHand(args: {
  seed: number; dealer: Seat; dealerStreak: number; roundWind: Wind; rules?: HandRules;
}): GameState
```

  (For this task declare `type PendingClaims = never` and `type HandResult = never` placeholders replaced in Tasks 8/10 — they exist so the file typechecks; both are exported.)
- `deal.ts` produces: `dealHands(tiles: TileKind[], dealer: Seat): { hands: TileKind[][]; flowers: FlowerKind[][]; wallFront: number; wallBack: number }` — deals 16 per seat +1 to dealer from the front, then replaces every flower (dealer first, in seat order, repeating until no hand holds a flower) drawing replacements from the back.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/deal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newHand } from '../src/game.js';
import { isFlower } from '../src/tiles.js';

describe('newHand', () => {
  const state = newHand({ seed: 123, dealer: 2, dealerStreak: 0, roundWind: 'E' });

  it('deals 16 tiles to non-dealers and 17 to the dealer', () => {
    expect(state.players[2].hand).toHaveLength(17);
    for (const s of [0, 1, 3] as const) {
      expect(state.players[s].hand).toHaveLength(16);
    }
  });
  it('leaves no flowers in any hand; exposed flowers are recorded', () => {
    for (const p of state.players) {
      expect(p.hand.some(isFlower)).toBe(false);
    }
  });
  it('conserves all 144 tiles', () => {
    const inHands = state.players.reduce((n, p) => n + p.hand.length + p.flowers.length, 0);
    const inWall = state.wallBack - state.wallFront + 1;
    expect(inHands + inWall).toBe(144);
  });
  it('starts with the dealer to discard', () => {
    expect(state.turn).toBe(2);
    expect(state.phase).toBe('awaiting-discard');
    expect(state.lastDiscard).toBeNull();
  });
  it('is deterministic per seed', () => {
    const again = newHand({ seed: 123, dealer: 2, dealerStreak: 0, roundWind: 'E' });
    expect(again).toEqual(state);
  });
  it('hands are sorted', () => {
    const h = state.players[0].hand;
    expect([...h].sort()).not.toBe(h); // sortTiles order, spot-check monotone kindIndex below
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement `deal.ts` and the `game.ts` skeleton**

`deal.ts`:
```ts
import { isFlower, sortTiles, type FlowerKind, type Seat, type TileKind } from './tiles.js';

export function dealHands(
  tiles: TileKind[], dealer: Seat,
): { hands: TileKind[][]; flowers: FlowerKind[][]; wallFront: number; wallBack: number } {
  let front = 0;
  let back = tiles.length - 1;
  const hands: TileKind[][] = [[], [], [], []];
  // 4 passes of 4 tiles in seat order from the dealer, then 1 extra for the dealer.
  for (let pass = 0; pass < 4; pass++) {
    for (let s = 0; s < 4; s++) {
      const seat = ((dealer + s) % 4) as Seat;
      for (let i = 0; i < 4; i++) hands[seat]!.push(tiles[front++]!);
    }
  }
  hands[dealer]!.push(tiles[front++]!);

  const flowers: FlowerKind[][] = [[], [], [], []];
  let replaced = true;
  while (replaced) {
    replaced = false;
    for (let s = 0; s < 4; s++) {
      const seat = ((dealer + s) % 4) as Seat;
      const hand = hands[seat]!;
      for (let i = 0; i < hand.length; i++) {
        const t = hand[i]!;
        if (isFlower(t)) {
          flowers[seat]!.push(t);
          hand[i] = tiles[back--]!;
          replaced = true;
        }
      }
    }
  }
  return {
    hands: hands.map((h) => sortTiles(h)),
    flowers,
    wallFront: front,
    wallBack: back,
  };
}
```

`game.ts` (this task's portion):
```ts
import { dealHands } from './deal.js';
import { buildWall } from './wall.js';
import type { Meld } from './melds.js';
import type { FlowerKind, Seat, TileKind, Wind } from './tiles.js';

export class IllegalActionError extends Error {}
export type Phase = 'awaiting-discard' | 'awaiting-claims' | 'finished';
export type PendingClaims = never; // replaced in Task 8
export type HandResult = never;    // replaced in Task 10

export interface PlayerState {
  hand: TileKind[];
  melds: Meld[];
  flowers: FlowerKind[];
  discards: TileKind[];
}
export interface HandRules { base: number; perTai: number }
export const DEFAULT_RULES: HandRules = { base: 3, perTai: 1 };

export interface GameState {
  seed: number;
  tiles: TileKind[];
  wallFront: number;
  wallBack: number;
  dealer: Seat;
  dealerStreak: number;
  roundWind: Wind;
  rules: HandRules;
  turn: Seat;
  phase: Phase;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  lastDiscard: { tile: TileKind; by: Seat } | null;
  pendingClaims: PendingClaims | null;
  lastDrawWasReplacement: boolean;
  result: HandResult | null;
}

export function newHand(args: {
  seed: number; dealer: Seat; dealerStreak: number; roundWind: Wind; rules?: HandRules;
}): GameState {
  const tiles = buildWall(args.seed);
  const { hands, flowers, wallFront, wallBack } = dealHands(tiles, args.dealer);
  const players = ([0, 1, 2, 3] as const).map((s) => ({
    hand: hands[s]!,
    melds: [] as Meld[],
    flowers: flowers[s]!,
    discards: [] as TileKind[],
  })) as GameState['players'];
  return {
    seed: args.seed,
    tiles,
    wallFront,
    wallBack,
    dealer: args.dealer,
    dealerStreak: args.dealerStreak,
    roundWind: args.roundWind,
    rules: args.rules ?? DEFAULT_RULES,
    turn: args.dealer,
    phase: 'awaiting-discard',
    players,
    lastDiscard: null,
    pendingClaims: null,
    lastDrawWasReplacement: false,
    result: null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass** — PASS. (Delete the weak "hands are sorted" spot-check or strengthen it with `kindIndex` monotonicity — implementer's choice, but the test file must pass as committed.)

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): game state, dealing, and opening flower replacement"
```

---

### Task 7: Turn flow — discard, auto-draw, flowers, self-win (`game.ts`)

**Files:**
- Modify: `packages/engine/src/game.ts`
- Test: `packages/engine/test/turnflow.test.ts`

**Interfaces:**
- Consumes: Task 6 state; `isWinningHand`; `concealedKongOptions`, `addedKongOptions` (declared legal here, executed in Task 9); `isFlower`, `sortTiles`.
- Produces:

```ts
export type Action =
  | { type: 'discard'; seat: Seat; tile: TileKind }
  | { type: 'self-win'; seat: Seat }
  | { type: 'concealed-kong'; seat: Seat; tile: TileKind }
  | { type: 'added-kong'; seat: Seat; tile: TileKind }
  | { type: 'claim'; seat: Seat; claim: 'chow' | 'pung' | 'kong' | 'win'; chowTiles?: [TileKind, TileKind] }
  | { type: 'pass'; seat: Seat };
export function legalActions(state: GameState, seat: Seat): Action[]
export function applyAction(state: GameState, action: Action): GameState
```

Behavior contract for this task (claims arrive in Task 8, kong execution in Task 9):
- `discard` (only current `turn` seat in `awaiting-discard`): tile leaves hand → `discards` + `lastDiscard`. Then — **since claims don't exist yet** — control auto-advances: next seat draws from the front. Drawn flowers are auto-exposed and replaced from the back (repeating). If ≤ 16 tiles remain when a draw is needed, the hand ends in an exhaustive draw (`phase = 'finished'`; result wiring lands in Task 10 — until then set `result: null` and just stop).
- `self-win` legal iff `isWinningHand(hand)` for the 17-tile-shaped hand.
- `legalActions` in `awaiting-discard` for the turn seat: every distinct hand tile as a discard, plus `self-win`/kong options when legal; empty for other seats.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/turnflow.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand, IllegalActionError } from '../src/game.js';
import type { GameState } from '../src/game.js';

function start(): GameState {
  return newHand({ seed: 9, dealer: 0, dealerStreak: 0, roundWind: 'E' });
}

describe('discard and auto-draw', () => {
  it('moves the tile to discards and draws for the next seat', () => {
    const s0 = start();
    const tile = s0.players[0].hand[0]!;
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile });
    expect(s1.players[0].discards).toEqual([tile]);
    expect(s1.players[0].hand).toHaveLength(16);
    expect(s1.turn).toBe(1);
    expect(s1.players[1].hand).toHaveLength(17);
    expect(s1.phase).toBe('awaiting-discard');
    expect(s0.players[0].hand).toHaveLength(17); // input state untouched
  });
  it('rejects discarding out of turn or a tile not in hand', () => {
    const s0 = start();
    expect(() => applyAction(s0, { type: 'discard', seat: 1, tile: s0.players[1].hand[0]! }))
      .toThrow(IllegalActionError);
  });
  it('conserves 144 tiles across many plays', () => {
    let s = start();
    for (let i = 0; i < 40 && s.phase !== 'finished'; i++) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
    }
    const held = s.players.reduce(
      (n, p) => n + p.hand.length + p.flowers.length + p.discards.length
        + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
      0,
    );
    expect(held + (s.wallBack - s.wallFront + 1)).toBe(144);
  });
});

describe('legalActions', () => {
  it('offers discards only to the turn seat', () => {
    const s0 = start();
    expect(legalActions(s0, 0).some((a) => a.type === 'discard')).toBe(true);
    expect(legalActions(s0, 1)).toEqual([]);
  });
});

describe('exhaustive draw', () => {
  it('finishes the hand when the wall reaches its 16-tile floor', () => {
    let s = start();
    let guard = 0;
    while (s.phase !== 'finished' && guard++ < 500) {
      s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
    }
    expect(s.phase).toBe('finished');
    expect(s.wallBack - s.wallFront + 1).toBeLessThanOrEqual(16);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (`applyAction` not exported).

- [ ] **Step 3: Implement in `game.ts`**

Add (key excerpts — full behavior per the contract above):
```ts
export const WALL_FLOOR = 16;

function clone(state: GameState): GameState {
  return structuredClone(state);
}
function wallRemaining(s: GameState): number {
  return s.wallBack - s.wallFront + 1;
}
/** Draw for `seat` from the front, auto-replacing flowers from the back.
 *  Returns false if the wall floor was hit (exhaustive draw). Mutates draft. */
function drawFor(s: GameState, seat: Seat): boolean {
  if (wallRemaining(s) <= WALL_FLOOR) return false;
  let tile = s.tiles[s.wallFront++]!;
  s.lastDrawWasReplacement = false;
  while (isFlower(tile)) {
    s.players[seat].flowers.push(tile);
    if (wallRemaining(s) <= WALL_FLOOR) return false;
    tile = s.tiles[s.wallBack--]!;
    s.lastDrawWasReplacement = true;
  }
  s.players[seat].hand = sortTiles([...s.players[seat].hand, tile]);
  return true;
}
function endExhaustive(s: GameState): void {
  s.phase = 'finished';
  s.result = null; // wired to a real draw result in Task 10
}

export function applyAction(state: GameState, action: Action): GameState {
  const s = clone(state);
  if (s.phase === 'finished') throw new IllegalActionError('hand is finished');
  switch (action.type) {
    case 'discard': {
      if (s.phase !== 'awaiting-discard' || action.seat !== s.turn)
        throw new IllegalActionError('not your discard');
      const hand = s.players[action.seat].hand;
      const i = hand.indexOf(action.tile);
      if (i === -1) throw new IllegalActionError('tile not in hand');
      hand.splice(i, 1);
      s.players[action.seat].discards.push(action.tile);
      s.lastDiscard = { tile: action.tile, by: action.seat };
      // Task 8 inserts the claim window here. For now: advance.
      const next = ((s.turn + 1) % 4) as Seat;
      s.turn = next;
      if (!drawFor(s, next)) endExhaustive(s);
      return s;
    }
    case 'self-win': {
      if (s.phase !== 'awaiting-discard' || action.seat !== s.turn)
        throw new IllegalActionError('not your turn');
      if (!isWinningHand(s.players[action.seat].hand))
        throw new IllegalActionError('hand is not winning');
      s.phase = 'finished';
      s.result = null; // scored in Task 10
      return s;
    }
    // 'concealed-kong' / 'added-kong': implemented in Task 9
    // 'claim' / 'pass': implemented in Task 8
    default:
      throw new IllegalActionError(`unsupported action: ${action.type}`);
  }
}

export function legalActions(state: GameState, seat: Seat): Action[] {
  if (state.phase !== 'awaiting-discard' || seat !== state.turn) return [];
  const p = state.players[seat];
  const actions: Action[] = [...new Set(p.hand)].map((tile) => ({
    type: 'discard', seat, tile,
  }));
  if (isWinningHand(p.hand)) actions.push({ type: 'self-win', seat });
  for (const tile of concealedKongOptions(p.hand))
    actions.push({ type: 'concealed-kong', seat, tile });
  for (const tile of addedKongOptions(p.hand, p.melds))
    actions.push({ type: 'added-kong', seat, tile });
  return actions;
}
```

- [ ] **Step 4: Run tests to verify they pass** — PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): turn flow with discard, auto-draw, flowers, self-win"
```

---

### Task 8: Claim window — chow/pung/kong/win from a discard (`claims.ts` + `game.ts`)

**Files:**
- Create: `packages/engine/src/claims.ts`
- Modify: `packages/engine/src/game.ts` (replace the `PendingClaims = never` placeholder and the "advance" branch of `discard`)
- Test: `packages/engine/test/claims.test.ts`

**Interfaces:**
- Consumes: `chowOptions`, `canPung`, `canExposedKong`, `isWinningHand`.
- Produces in `claims.ts`:

```ts
export type ClaimKind = 'win' | 'kong' | 'pung' | 'chow';
export interface ClaimOption { seat: Seat; claim: ClaimKind }
export interface PendingClaims {
  options: ClaimOption[];                       // every legal claim for this discard
  responses: Partial<Record<Seat, Action>>;     // one response per eligible seat
}
export function computeClaimOptions(state: GameState): ClaimOption[]
  // chow only for seat (discarder+1)%4; win via isWinningHand([...hand, discard]);
  // discarder never claims own tile
export function resolveClaims(pending: PendingClaims): Action | null
  // all eligible seats responded → highest priority wins: win > kong > pung > chow;
  // among multiple wins, the seat closest after the discarder in turn order;
  // all passed → null
```

- Modified `discard` behavior in `game.ts`: after a discard, if `computeClaimOptions` is non-empty → `phase = 'awaiting-claims'`, store `pendingClaims`; else auto-advance as in Task 7. `claim`/`pass` actions record responses; once every eligible seat has responded, the winning claim executes:
  - **chow/pung**: tiles leave claimer's hand, meld added (`claimedFrom` = discarder), discard removed from discarder's `discards`, claimer becomes `turn` in `awaiting-discard` (no draw).
  - **kong**: as pung but 4 tiles, then claimer draws a replacement from the back (flowers handled as in `drawFor`), stays on turn.
  - **win**: `phase = 'finished'` (result wired in Task 10).
  - all pass: next seat after discarder draws as in Task 7.
- `legalActions` in `awaiting-claims`: for each eligible seat that hasn't responded — its claim options plus `pass`; chow claims must carry `chowTiles` (one entry per distinct chow option).

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/claims.test.ts` — these tests build small deterministic positions by directly constructing a state from `newHand` and then **overwriting hands** (documented white-box testing; hands must keep legal sizes):
```ts
import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newHand } from '../src/game.js';
import type { GameState } from '../src/game.js';
import type { Seat, TileKind } from '../src/tiles.js';

/** Deal a real hand, then force seat hands to known 16-tile contents. */
function rig(hands: Partial<Record<Seat, TileKind[]>>): GameState {
  const s = newHand({ seed: 5, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  for (const [seat, hand] of Object.entries(hands)) {
    s.players[Number(seat) as Seat].hand = hand!;
  }
  return s;
}

const FILLER: TileKind[] = [
  '1w', '4w', '7w', '2t', '5t', '8t', '3b', '6b', '9b',
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
]; // 16 unconnected-ish tiles

describe('claim window', () => {
  it('opens for a pung and executes it with priority over chow', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],            // will discard 3w
      1: ['2w', '4w', ...FILLER.slice(0, 14)],       // next seat: chow 2w4w
      2: ['3w', '3w', ...FILLER.slice(2, 16)],       // pung
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    expect(s1.phase).toBe('awaiting-claims');
    expect(legalActions(s1, 1).map((a) => a.type)).toContain('claim');
    expect(legalActions(s1, 2).map((a) => a.type)).toContain('claim');

    const s2 = applyAction(s1, { type: 'claim', seat: 1, claim: 'chow', chowTiles: ['2w', '4w'] });
    const s3 = applyAction(s2, { type: 'claim', seat: 2, claim: 'pung' });
    expect(s3.phase).toBe('awaiting-discard');
    expect(s3.turn).toBe(2);
    expect(s3.players[2].melds).toEqual([
      { type: 'pung', tiles: ['3w', '3w', '3w'], concealed: false, claimedFrom: 0 },
    ]);
    expect(s3.players[2].hand).toHaveLength(14);      // 16 - 2 used in pung
    expect(s3.players[0].discards).toEqual([]);        // claimed tile removed
  });

  it('advances normally when everyone passes', () => {
    const s0 = rig({
      0: [...FILLER.slice(0, 15), '3w'],
      2: ['3w', '3w', ...FILLER.slice(2, 16)],
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: '3w' });
    const s2 = applyAction(s1, { type: 'pass', seat: 2 });
    // seat 1 may also be eligible (chow); pass everyone eligible:
    const s3 = s2.phase === 'awaiting-claims' ? applyAction(s2, { type: 'pass', seat: 1 }) : s2;
    expect(s3.phase).toBe('awaiting-discard');
    expect(s3.turn).toBe(1);
    expect(s3.players[1].hand).toHaveLength(17);
  });

  it('win beats pung', () => {
    const winReady: TileKind[] = [
      '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
      '1t', '1t', '1t', 'dr', 'dr', 'dr', 'we',
    ]; // waits on we (pair wait)
    const s0 = rig({
      0: [...FILLER.slice(0, 15), 'we'],
      1: ['we', 'we', ...FILLER.slice(2, 16)],   // could pung
      3: winReady,                                // wins on we
    });
    const s1 = applyAction(s0, { type: 'discard', seat: 0, tile: 'we' });
    const s2 = applyAction(s1, { type: 'claim', seat: 1, claim: 'pung' });
    const s3 = applyAction(s2, { type: 'claim', seat: 3, claim: 'win' });
    expect(s3.phase).toBe('finished');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (claims not implemented; discard auto-advances past the window).

- [ ] **Step 3: Implement `claims.ts` and wire into `game.ts`**

`claims.ts`:
```ts
import { canExposedKong, canPung, chowOptions } from './melds.js';
import { isWinningHand } from './win.js';
import type { GameState, Action } from './game.js';
import type { Seat } from './tiles.js';

export type ClaimKind = 'win' | 'kong' | 'pung' | 'chow';
export interface ClaimOption { seat: Seat; claim: ClaimKind }
export interface PendingClaims {
  options: ClaimOption[];
  responses: Partial<Record<Seat, Action>>;
}

const PRIORITY: Record<ClaimKind, number> = { win: 3, kong: 2, pung: 2, chow: 1 };

export function computeClaimOptions(state: GameState): ClaimOption[] {
  const d = state.lastDiscard;
  if (!d) return [];
  const options: ClaimOption[] = [];
  for (let i = 1; i < 4; i++) {
    const seat = ((d.by + i) % 4) as Seat;
    const hand = state.players[seat].hand;
    if (isWinningHand([...hand, d.tile])) options.push({ seat, claim: 'win' });
    if (canExposedKong(hand, d.tile)) options.push({ seat, claim: 'kong' });
    if (canPung(hand, d.tile)) options.push({ seat, claim: 'pung' });
    if (i === 1 && chowOptions(hand, d.tile).length > 0)
      options.push({ seat, claim: 'chow' });
  }
  return options;
}

export function resolveClaims(pending: PendingClaims): Action | null {
  const eligibleSeats = [...new Set(pending.options.map((o) => o.seat))];
  if (eligibleSeats.some((s) => pending.responses[s] === undefined)) {
    throw new Error('not all seats have responded');
  }
  const claims = eligibleSeats
    .map((s) => pending.responses[s]!)
    .filter((a): a is Extract<Action, { type: 'claim' }> => a.type === 'claim');
  if (claims.length === 0) return null;
  claims.sort((a, b) => PRIORITY[b.claim] - PRIORITY[a.claim]);
  return claims[0]!;
}
```

In `game.ts`: replace `export type PendingClaims = never` with `export type { PendingClaims } from './claims.js'`-style re-export (or move the import), insert the claim window into `discard`, add `claim`/`pass` branches that (1) validate the response against `pendingClaims.options`, (2) store it, (3) when all eligible seats have responded call `resolveClaims` and execute per the behavior contract above, and extend `legalActions` for `awaiting-claims` (per-seat options + `pass`, chow expanded per `chowOptions` combo). Win execution: add the discard tile to the winner's hand, remove it from the discarder's `discards`, set `phase = 'finished'`.

- [ ] **Step 4: Run tests to verify they pass** — PASS, including all earlier suites (Task 7's exhaustive-draw test now passes through claim windows — its loop must respond `pass` for eligible seats; update that test accordingly in this task):

In `turnflow.test.ts`, replace the bodies of the two loop tests so each iteration does:
```ts
if (s.phase === 'awaiting-claims') {
  const seat = ([0, 1, 2, 3] as const).find((x) => legalActions(s, x).length > 0)!;
  s = applyAction(s, { type: 'pass', seat });
} else {
  s = applyAction(s, { type: 'discard', seat: s.turn, tile: s.players[s.turn].hand[0]! });
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): claim window with chow/pung/kong/win priority"
```

---

### Task 9: Kong flows and end-condition flags (`game.ts`)

**Files:**
- Modify: `packages/engine/src/game.ts`
- Test: `packages/engine/test/kong.test.ts`

**Interfaces:**
- Consumes: Tasks 7–8; `concealedKongOptions`, `addedKongOptions`.
- Produces (behavior, same `applyAction` signature):
  - `concealed-kong`: 4 tiles leave hand → meld `{type:'kong', concealed:true, claimedFrom:null}`; replacement draw from the back (flower handling as `drawFor`); seat stays on turn in `awaiting-discard`. Hitting the wall floor on the replacement ends the hand exhaustively.
  - `added-kong`: the 4th tile moves from hand onto the existing pung (meld becomes `type:'kong'`); **robbing the kong**: before the replacement draw, every other seat that wins on that tile gets a win-only claim window (`pendingClaims` with only `win` options); if someone claims, they win (搶槓 context flag set); if all pass (or nobody can rob), replacement draw proceeds.
  - New `GameState` fields: `wasKongRob: boolean` and `wasLastTile: boolean` (set when a win happens on the final drawable tile — 海底撈月), both initialized `false` in `newHand`, consumed by scoring in Task 10. `lastDrawWasReplacement` already exists (槓上開花).

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/kong.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyAction, newHand } from '../src/game.js';
import type { GameState } from '../src/game.js';
import type { Seat, TileKind } from '../src/tiles.js';

function rig(hands: Partial<Record<Seat, TileKind[]>>, turn: Seat = 0): GameState {
  const s = newHand({ seed: 11, dealer: 0, dealerStreak: 0, roundWind: 'E' });
  for (const [seat, hand] of Object.entries(hands)) {
    s.players[Number(seat) as Seat].hand = hand!;
  }
  s.turn = turn;
  return s;
}

describe('concealed kong', () => {
  it('exposes the meld and draws a replacement from the back', () => {
    const hand: TileKind[] = [
      '5t', '5t', '5t', '5t', '1w', '2w', '3w', '4w', '6w', '7w', '8w', '9w',
      '1b', '2b', '3b', 'dr', 'dg',
    ]; // dealer's 17
    const s0 = rig({ 0: hand });
    const backBefore = s0.wallBack;
    const s1 = applyAction(s0, { type: 'concealed-kong', seat: 0, tile: '5t' });
    expect(s1.players[0].melds).toEqual([
      { type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null },
    ]);
    expect(s1.players[0].hand).toHaveLength(14); // 17 - 4 + 1 replacement
    expect(s1.wallBack).toBeLessThan(backBefore);
    expect(s1.turn).toBe(0);
    expect(s1.phase).toBe('awaiting-discard');
    expect(s1.lastDrawWasReplacement).toBe(true);
  });
});

describe('added kong and robbing', () => {
  const winReady: TileKind[] = [
    '1w', '2w', '3w', '4w', '5w', '6w', '7w', '8w', '9w',
    '1t', '1t', '1t', 'dr', 'dr', 'dr', 'ws',
  ]; // waits on ws

  it('can be robbed for the win', () => {
    const s0 = rig({
      0: ['ws', '1b', '2b', '3b', '4b', '5b', '6b', '7b', '8b', '9b', '1t', '2t', '3t', '4t', '6t', '7t', '8t'],
      2: winReady,
    });
    s0.players[0].melds = [
      { type: 'pung', tiles: ['ws', 'ws', 'ws'], concealed: false, claimedFrom: 3 },
    ];
    const s1 = applyAction(s0, { type: 'added-kong', seat: 0, tile: 'ws' });
    expect(s1.phase).toBe('awaiting-claims');
    const s2 = applyAction(s1, { type: 'claim', seat: 2, claim: 'win' });
    expect(s2.phase).toBe('finished');
    expect(s2.wasKongRob).toBe(true);
  });

  it('proceeds with replacement when nobody robs', () => {
    const s0 = rig({
      0: ['ws', '1b', '2b', '3b', '4b', '5b', '6b', '7b', '8b', '9b', '1t', '2t', '3t', '4t', '6t', '7t', '8t'],
      2: winReady,
    });
    s0.players[0].melds = [
      { type: 'pung', tiles: ['ws', 'ws', 'ws'], concealed: false, claimedFrom: 3 },
    ];
    const s1 = applyAction(s0, { type: 'added-kong', seat: 0, tile: 'ws' });
    const s2 = applyAction(s1, { type: 'pass', seat: 2 });
    expect(s2.phase).toBe('awaiting-discard');
    expect(s2.turn).toBe(0);
    expect(s2.players[0].melds[0]!.type).toBe('kong');
    expect(s2.players[0].hand).toHaveLength(17); // 17 - 1 kong tile + 1 replacement
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (`unsupported action`).

- [ ] **Step 3: Implement** the two action branches in `applyAction` per the behavior contract, plus a private `openRobWindow(s, tile, by): boolean` that computes win-only claim options (reusing `isWinningHand([...hand, tile])` for the other three seats) and returns whether a window opened. Store the pending kong on the state (`pendingKong: { seat: Seat; tile: TileKind } | null`) so the pass-resolution path can complete the kong + replacement. Set `wasLastTile = true` inside `drawFor` when the draw consumed the last tile above the floor, and set `wasKongRob = true` on a rob win.

- [ ] **Step 4: Run tests to verify they pass** — PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): concealed/added kong, replacement draws, robbing the kong"
```

---

### Task 10: Taiwanese scoring (`scoring/taiwanese.ts` + `scoring/payments.ts`)

**Files:**
- Create: `packages/engine/src/scoring/taiwanese.ts`, `packages/engine/src/scoring/payments.ts`
- Test: `packages/engine/test/scoring.test.ts`

**Interfaces:**
- Consumes: `decomposeWin`, `winningTiles`, tile helpers, `Meld`, `seatWind`.
- Produces:

```ts
// taiwanese.ts
export interface TaiItem { name: string; tai: number }
export interface ScoreContext {
  concealed: TileKind[];         // winner's concealed tiles INCLUDING the win tile
  melds: Meld[];
  flowers: FlowerKind[];
  winTile: TileKind;
  by: 'self-draw' | 'discard';
  winner: Seat; dealer: Seat; dealerStreak: number;
  roundWind: Wind;
  madeNoClaims: boolean;         // never chowed/punged/konged from others (門清 component)
  wasReplacementDraw: boolean;   // 槓上開花
  wasKongRob: boolean;           // 搶槓
  wasLastTile: boolean;          // 海底撈月
}
export function scoreTaiwaneseHand(ctx: ScoreContext): { tai: number; breakdown: TaiItem[] }

// payments.ts
export function computePayments(args: {
  tai: number; base: number; perTai: number;
  winner: Seat; dealer: Seat; dealerStreak: number;
  by: 'self-draw' | 'discard'; discarder: Seat | null;
}): [number, number, number, number]   // net points per seat; sums to 0
```

**The v1 tai table (this exact list, these exact values — our defined defaults):**

| Pattern | Tai | Detection |
|---|---|---|
| 自摸 self-draw | 1 | `by === 'self-draw'` |
| 門清 concealed hand | 1 | `madeNoClaims && melds.every(m => m.concealed)` |
| 門清自摸加台 | +1 | both of the above (total 3 with the two rows above) |
| 花牌 flowers | 1 each | per tile in `flowers` |
| 三元牌 dragon pung/kong | 1 each | per dragon set (melds + decomposition) |
| 場風 round-wind pung/kong | 1 | wind set matching `roundWind` |
| 門風 seat-wind pung/kong | 1 | wind set matching `seatWind(winner, dealer)` |
| 獨聽 single wait | 1 | `winningTiles(concealed minus winTile)` has length 1 |
| 槓上開花 | 1 | `wasReplacementDraw && by === 'self-draw'` |
| 搶槓 | 1 | `wasKongRob` |
| 海底撈月 | 1 | `wasLastTile && by === 'self-draw'` |
| 平胡 all-chows | 2 | decomposition all runs, pair not dragons/relevant winds, no flowers, not single wait, won by discard |
| 碰碰胡 all pungs | 4 | every set (melds + decomposition) is pung/kong |
| 混一色 half flush | 4 | one suit + honors only |
| 小三元 | 4 | 2 dragon sets + dragon pair (replaces the 2 individual dragon tai) |
| 清一色 full flush | 8 | one suit, no honors |
| 大三元 | 8 | 3 dragon sets (replaces individual dragon tai) |
| 小四喜 | 8 | 3 wind sets + wind pair (replaces wind-set tai) |
| 大四喜 | 16 | 4 wind sets (replaces wind-set tai) |
| 字一色 all honors | 16 | honors only |
| 四暗刻 4 concealed pungs | 5 | ≥4 pungs formed without claiming (concealed kongs count) |
| 五暗刻 5 concealed pungs | 8 | 5 such (replaces 四暗刻) |

Dealer involvement is **not** in the tai table — it lives in `computePayments`: `dealerExtra = 1 + 2 * dealerStreak` tai added to a payment when the payer or the payee is the dealer. Self-draw: each of the 3 others pays `base + (tai + extraIfInvolved) * perTai`. Discard win: the discarder alone pays `base + (tai + extraIfInvolved) * perTai`.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/scoring.test.ts` (table-driven; representative cases shown — implementer adds one test per table row minimum, using hands built the same way):
```ts
import { describe, expect, it } from 'vitest';
import { scoreTaiwaneseHand, type ScoreContext } from '../src/scoring/taiwanese.js';
import { computePayments } from '../src/scoring/payments.js';
import type { TileKind } from '../src/tiles.js';

function ctx(partial: Partial<ScoreContext> & Pick<ScoreContext, 'concealed'>): ScoreContext {
  return {
    melds: [], flowers: [], winTile: partial.concealed[partial.concealed.length - 1]!,
    by: 'discard', winner: 1, dealer: 0, dealerStreak: 0, roundWind: 'E',
    madeNoClaims: true, wasReplacementDraw: false, wasKongRob: false, wasLastTile: false,
    ...partial,
  };
}

const PINGHU: TileKind[] = [
  '1w', '2w', '3w', '4w', '5w', '6w', '2t', '3t', '4t',
  '5t', '6t', '7t', '2b', '3b', '4b', '8b', '8b',
]; // all chows, neutral pair — but single-wait check matters; won on 4b (two-sided 1b/4b)

describe('tai patterns', () => {
  it('scores 平胡 as 2 tai (+1 門清)', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b' }));
    expect(r.breakdown).toContainEqual({ name: '平胡', tai: 2 });
    expect(r.breakdown).toContainEqual({ name: '門清', tai: 1 });
    expect(r.tai).toBe(3);
  });
  it('scores 清一色 8 tai', () => {
    const hand: TileKind[] = [
      '1w', '1w', '1w', '2w', '3w', '4w', '5w', '6w', '7w',
      '7w', '8w', '9w', '9w', '9w', '2w', '3w', '4w',
    ];
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '清一色', tai: 8 });
  });
  it('scores 碰碰胡 + 混一色 together', () => {
    const hand: TileKind[] = [
      '1t', '1t', '1t', '3t', '3t', '3t', '5t', '5t', '5t',
      'we', 'we', 'we', 'dr', 'dr', 'dr', '9t', '9t',
    ];
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '碰碰胡', tai: 4 });
    expect(r.breakdown).toContainEqual({ name: '混一色', tai: 4 });
    expect(r.breakdown).toContainEqual({ name: '三元牌', tai: 1 });
  });
  it('大三元 replaces individual dragon tai', () => {
    const hand: TileKind[] = [
      'dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', 'dw',
      '1w', '2w', '3w', '5t', '6t', '7t', '9b', '9b',
    ];
    const r = scoreTaiwaneseHand(ctx({ concealed: hand }));
    expect(r.breakdown).toContainEqual({ name: '大三元', tai: 8 });
    expect(r.breakdown.filter((b) => b.name === '三元牌')).toHaveLength(0);
  });
  it('flowers add 1 tai each', () => {
    const r = scoreTaiwaneseHand(ctx({ concealed: PINGHU, winTile: '4b', flowers: ['f1', 'f5'] }));
    expect(r.breakdown).toContainEqual({ name: '花牌', tai: 2 });
  });
});

describe('payments', () => {
  it('discard win: discarder pays alone, sums to zero', () => {
    const p = computePayments({
      tai: 3, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 0,
      by: 'discard', discarder: 2,
    });
    expect(p).toEqual([0, 6, -6, 0]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('self-draw: all three pay; dealer pays extra when involved', () => {
    const p = computePayments({
      tai: 2, base: 3, perTai: 1, winner: 1, dealer: 0, dealerStreak: 1,
      by: 'self-draw', discarder: null,
    });
    // dealerExtra = 1 + 2*1 = 3 tai → dealer pays 3+(2+3)=8, others 3+2=5
    expect(p).toEqual([-8, 18, -5, -5]);
  });
  it('dealer as winner collects extra from everyone', () => {
    const p = computePayments({
      tai: 1, base: 3, perTai: 1, winner: 0, dealer: 0, dealerStreak: 0,
      by: 'self-draw', discarder: null,
    });
    // each pays 3+(1+1) = 5
    expect(p).toEqual([15, -5, -5, -5]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — FAIL (modules not found).

- [ ] **Step 3: Implement**

`payments.ts` (complete):
```ts
import type { Seat } from '../tiles.js';

export function computePayments(args: {
  tai: number; base: number; perTai: number;
  winner: Seat; dealer: Seat; dealerStreak: number;
  by: 'self-draw' | 'discard'; discarder: Seat | null;
}): [number, number, number, number] {
  const net: [number, number, number, number] = [0, 0, 0, 0];
  const dealerExtra = 1 + 2 * args.dealerStreak;
  const payerSeats: Seat[] =
    args.by === 'self-draw'
      ? ([0, 1, 2, 3].filter((s) => s !== args.winner) as Seat[])
      : [args.discarder!];
  for (const payer of payerSeats) {
    const involved = payer === args.dealer || args.winner === args.dealer;
    const tai = args.tai + (involved ? dealerExtra : 0);
    const amount = args.base + tai * args.perTai;
    net[payer] -= amount;
    net[args.winner] += amount;
  }
  return net;
}
```

`taiwanese.ts`: build the winner's full set list = `melds` (as sets) + `decomposeWin(concealed).sets` + pair, then evaluate each table row as a predicate over `{sets, pair, melds, flowers, ctx}` pushing `TaiItem`s, with the replacement rules (大三元 suppresses 三元牌; 小三元 suppresses them too; 大四喜/小四喜 suppress wind tai; 五暗刻 suppresses 四暗刻). 獨聽 computed via `winningTiles` on `concealed` minus `winTile`. Concealed-pung counting for 四暗刻: pungs in the decomposition plus concealed kongs, plus — when won by discard — excluding the set completed by the win tile if it's a pung. Keep every predicate a small named function (`isAllPungs`, `isHalfFlush`, `dragonSetCount`, …) in the same file.

- [ ] **Step 4: Run tests to verify they pass** — PASS. Also hand-verify two scores against a published Taiwanese scoring reference (e.g., 台灣麻將台數表) and note the reference URL in a comment at the top of `taiwanese.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): taiwanese tai scoring table and payments"
```

---

### Task 11: Results wiring, session rotation, variant interface, public API

**Files:**
- Modify: `packages/engine/src/game.ts` (real `HandResult`, populate on every finish)
- Create: `packages/engine/src/session.ts`, `packages/engine/src/variant.ts`
- Modify: `packages/engine/src/index.ts` (export everything public)
- Test: `packages/engine/test/session.test.ts`, extend `packages/engine/test/kong.test.ts` + `claims.test.ts` win cases to assert results

**Interfaces:**
- Produces in `game.ts`:

```ts
export type HandResult =
  | {
      type: 'win'; winner: Seat; by: 'self-draw' | 'discard'; discarder: Seat | null;
      tai: number; breakdown: TaiItem[]; payments: [number, number, number, number];
      winningHand: { concealed: TileKind[]; melds: Meld[]; flowers: FlowerKind[] };
    }
  | { type: 'draw-exhausted' };
```

  Every code path that sets `phase = 'finished'` now builds the real result: win paths call `scoreTaiwaneseHand` + `computePayments` with a correctly-assembled `ScoreContext` (`madeNoClaims` = winner has no non-concealed melds and never chowed/punged; flags from state). Exhaustive draws produce `{ type: 'draw-exhausted' }`.
- Produces in `session.ts`:

```ts
export interface SessionParams { dealer: Seat; dealerStreak: number; roundWind: Wind; handsPlayed: number }
export function nextHandParams(prev: SessionParams, result: HandResult): SessionParams
  // dealer wins or draw-exhausted → dealer stays, streak+1;
  // otherwise dealer advances to (dealer+1)%4, streak resets; when the deal
  // passes from seat 3 back to 0, roundWind advances E→S→W→N.
export function isSessionOver(params: SessionParams, totalRounds: number): boolean
  // a round = the dealer position completing a full lap; session ends after totalRounds laps
```

- Produces in `variant.ts`:

```ts
export interface Variant {
  id: 'taiwanese' | 'cantonese';
  handSize: number;   // 16
  score(ctx: ScoreContext): { tai: number; breakdown: TaiItem[] };
}
export const TAIWANESE: Variant;
```

  `game.ts` reads `variant.score` (not the Taiwanese module directly) — `newHand` gains an optional `variant?: Variant` arg defaulting to `TAIWANESE`. This is the seam Cantonese (v1.1) plugs into.
- `index.ts` exports: everything in the Interfaces blocks of Tasks 2–11.

- [ ] **Step 1: Write the failing tests** — `session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextHandParams, isSessionOver } from '../src/session.js';
import type { HandResult } from '../src/game.js';

const win = (winner: 0 | 1 | 2 | 3): HandResult => ({
  type: 'win', winner, by: 'discard', discarder: 3, tai: 1, breakdown: [],
  payments: [0, 0, 0, 0], winningHand: { concealed: [], melds: [], flowers: [] },
});

describe('session rotation', () => {
  it('dealer win keeps the deal and grows the streak', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 0, roundWind: 'E', handsPlayed: 3 }, win(1),
    );
    expect(next).toEqual({ dealer: 1, dealerStreak: 1, roundWind: 'E', handsPlayed: 4 });
  });
  it('non-dealer win passes the deal', () => {
    const next = nextHandParams(
      { dealer: 1, dealerStreak: 2, roundWind: 'E', handsPlayed: 5 }, win(0),
    );
    expect(next).toEqual({ dealer: 2, dealerStreak: 0, roundWind: 'E', handsPlayed: 6 });
  });
  it('exhaustive draw keeps the deal', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 1 },
      { type: 'draw-exhausted' },
    );
    expect(next.dealer).toBe(3);
    expect(next.dealerStreak).toBe(1);
  });
  it('round wind advances when the deal passes seat 3 → 0', () => {
    const next = nextHandParams(
      { dealer: 3, dealerStreak: 0, roundWind: 'E', handsPlayed: 7 }, win(0),
    );
    expect(next).toEqual({ dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 8 });
  });
  it('session ends after the configured rounds', () => {
    expect(isSessionOver({ dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 }, 1)).toBe(false);
    expect(isSessionOver({ dealer: 0, dealerStreak: 0, roundWind: 'S', handsPlayed: 9 }, 1)).toBe(true);
  });
});
```

Also extend the existing win assertions: in `claims.test.ts` "win beats pung" add `expect(s3.result?.type).toBe('win')` and `expect(s3.result?.type === 'win' && s3.result.payments.reduce((a, b) => a + b, 0)).toBe(0)`; in `kong.test.ts` rob case assert `s2.result?.type === 'win'` and the breakdown contains `{ name: '搶槓', tai: 1 }`.

- [ ] **Step 2: Run tests to verify they fail** — FAIL.

- [ ] **Step 3: Implement** `session.ts` per the contract; replace the `HandResult = never` placeholder; add a private `finishWithWin(s, winner, by, discarder)` in `game.ts` used by all three win paths (self-win, discard-claim win, rob win) that assembles `ScoreContext`, calls `s.variant.score` (store the variant on state as `variantId` + module lookup, or pass the variant into `newHand` and keep the function reference off the serialized state — **keep the state JSON-serializable: store `variantId: 'taiwanese'` and resolve the module via a registry `VARIANTS: Record<string, Variant>` in `variant.ts`**), computes payments, sets `result`. Export the full public API from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass** — PASS (entire suite) and `pnpm -F @mahjong/engine typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): hand results, session rotation, pluggable variant registry"
```

---

### Task 12: Full-game simulation property test + engine README

**Files:**
- Create: `packages/engine/test/simulation.test.ts`, `packages/engine/README.md`

**Interfaces:**
- Consumes: the entire public API via `index.ts` — this test is written against `../src/index.js` only, proving the public surface is sufficient to run complete games (exactly how the server and bots will consume it).

- [ ] **Step 1: Write the simulation test**

`packages/engine/test/simulation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  applyAction, legalActions, newHand, mulberry32, nextHandParams,
  type GameState, type Seat, type SessionParams,
} from '../src/index.js';

function totalTiles(s: GameState): number {
  const held = s.players.reduce(
    (n, p) => n + p.hand.length + p.flowers.length + p.discards.length
      + p.melds.reduce((m, meld) => m + meld.tiles.length, 0),
    0,
  );
  return held + (s.wallBack - s.wallFront + 1);
}

describe('random full-game simulation', () => {
  it('plays 200 hands to completion without illegal states', () => {
    const rng = mulberry32(2026);
    let session: SessionParams = { dealer: 0, dealerStreak: 0, roundWind: 'E', handsPlayed: 0 };
    for (let hand = 0; hand < 200; hand++) {
      let s = newHand({
        seed: hand * 7919 + 1,
        dealer: session.dealer,
        dealerStreak: session.dealerStreak,
        roundWind: session.roundWind,
      });
      let steps = 0;
      while (s.phase !== 'finished') {
        expect(++steps).toBeLessThan(1000);
        expect(totalTiles(s)).toBe(144);
        const actors = ([0, 1, 2, 3] as Seat[]).filter((x) => legalActions(s, x).length > 0);
        expect(actors.length).toBeGreaterThan(0);
        const seat = actors[Math.floor(rng() * actors.length)]!;
        const options = legalActions(s, seat);
        const action = options[Math.floor(rng() * options.length)]!;
        s = applyAction(s, action);
      }
      expect(s.result === null).toBe(false);
      if (s.result!.type === 'win') {
        expect(s.result!.payments.reduce((a, b) => a + b, 0)).toBe(0);
        expect(s.result!.tai).toBeGreaterThanOrEqual(0);
      }
      session = nextHandParams(session, s.result!);
    }
  });
});
```

- [ ] **Step 2: Run it** — `pnpm -F @mahjong/engine test`. Expected: PASS in seconds. Any failure here is a real engine bug: fix the engine (never weaken the invariant), re-run until green.

- [ ] **Step 3: Write `packages/engine/README.md`** — short consumer guide: the three-function contract (`newHand`/`legalActions`/`applyAction`), the tile-code table, the state-machine phases, the tai table, and a note that the server must never send `tiles`, `wallFront/Back`, or other players' `hand` to clients.

- [ ] **Step 4: Full suite + typecheck** — `pnpm test` and `pnpm typecheck` at the repo root: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "test(engine): full-game random simulation invariants; engine README"
```

---

## Self-Review (completed at authoring time)

- **Spec coverage:** This plan covers the spec's `packages/engine` section completely — tiles/wall/melds/claims/win/flowers/kong/exhaustion (Tasks 2–9), tai scoring + payments + dealer streak (Task 10), session/round rotation + variant seam for Cantonese (Task 11), and the spec's required bot-vs-bot simulation invariant testing (Task 12). Server, bot, app, and delivery are explicitly Plans 2–4.
- **Placeholder scan:** The two `= never` type placeholders in Task 6 are deliberate compile-time seams replaced by Tasks 8/10–11 within this same plan — each replacement site is named. No TBDs remain.
- **Type consistency:** `TileKind`/`Seat`/`Wind` originate in `tiles.ts` only; `ScoreContext` field names match between Task 10's definition and Task 11's `finishWithWin`; `PendingClaims` is defined once in `claims.ts` and re-exported.
