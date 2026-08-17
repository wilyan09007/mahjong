# CLAUDE.md

## Start here

**Read `CONTEXT.md` before touching anything.** It maps every file in the repo —
key exports, what each one does, the engine's state/action reference, and the
cross-cutting rules (tile codes, purity constraints, scoring defaults). It exists
so you don't have to read the 1,700-line plan to find out where something lives.

Open the source documents only for detail `CONTEXT.md` points you at:

- `docs/superpowers/specs/2026-08-16-mahjong-app-design.md` — approved design spec (the "why")
- `docs/superpowers/plans/2026-08-16-v1-plan-1-engine.md` — Plan 1, task-by-task with tests

## Finishing work

**Update `CONTEXT.md` in the same commit as the code.** Flip 📋 → ✅, correct the
exports to what you actually built, and fix the state/action reference if it
changed. Where the map and the code disagree, the code is right and the map
follows it — a stale row sends the next agent to a function that doesn't exist.

Commits are conventional (`feat:`, `test:`, `chore:`), one per plan task.

## Non-negotiables

- **The engine is pure.** No I/O, no `Date.now()`, no `Math.random()` —
  randomness only via the seeded `mulberry32` in `wall.ts`. `applyAction` never
  mutates its input. Illegal actions throw `IllegalActionError`, never fail
  silently.
- **The server owns all hidden information.** Never send `tiles`,
  `wallFront`/`wallBack`, or another player's `hand` to a client.
- **Tests before implementation** — every plan task is written failing-test-first.
  A simulation-test failure is a real engine bug: fix the engine, never weaken
  the invariant.
- Node ≥ 20, pnpm ≥ 9, TypeScript `strict`. `pnpm test` and `pnpm typecheck` at
  the root must both be green before a commit.
