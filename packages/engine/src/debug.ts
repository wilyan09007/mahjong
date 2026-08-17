/**
 * Human-readable renderings of engine values.
 *
 * A pure state machine is opaque when it misbehaves: there is no log to read,
 * no debugger to attach to a server three time zones away, and a bug report
 * arrives as "seed 8231 threw on step 47". Everything here exists to make that
 * report actionable — paste the seed in, dump the state, read what the engine
 * actually saw.
 *
 * PURITY: every function here RETURNS a string. Nothing prints. The engine
 * does no I/O, so the choice of where verbose output goes belongs to the
 * caller — a test, a server log, an assertion message. `traceAction` and
 * `traceHand` build transcripts as data for exactly this reason.
 *
 * Tile codes are always shown alongside their glyphs: the code is what you
 * paste into a test fixture, the glyph is what you read.
 */

import { legalActions, applyAction, type Action, type GameState, type HandResult } from './game.js';
import type { Meld } from './melds.js';
import { isFlower, seatWind, type Seat, type TileKind } from './tiles.js';

const GLYPHS: Record<string, string> = {
  w: '萬', t: '筒', b: '條',
  we: '東', ws: '南', ww: '西', wn: '北',
  dr: '中', dg: '發', dw: '白',
};

/** `3w` → `3萬`, `dr` → `中`, `f4` → `花4`. */
export function formatTile(t: TileKind): string {
  if (isFlower(t)) return `花${t[1]}`;
  const honor = GLYPHS[t];
  if (honor) return honor;
  return `${t[0]}${GLYPHS[t[1]!] ?? t[1]}`;
}

/** Codes first (paste-ready), glyphs second (readable). Empty reads as `-`. */
export function formatTiles(tiles: TileKind[]): string {
  if (tiles.length === 0) return '-';
  return `${tiles.join(' ')}   ${tiles.map(formatTile).join('')}`;
}

export function formatMeld(m: Meld): string {
  const origin = m.concealed ? 'concealed' : `from seat ${m.claimedFrom}`;
  return `${m.type}(${m.tiles.join('')} ${m.tiles.map(formatTile).join('')}, ${origin})`;
}

export function formatAction(a: Action): string {
  switch (a.type) {
    case 'discard':
      return `seat ${a.seat} discard ${a.tile} (${formatTile(a.tile)})`;
    case 'self-win':
      return `seat ${a.seat} self-win`;
    case 'concealed-kong':
      return `seat ${a.seat} concealed-kong ${a.tile} (${formatTile(a.tile)})`;
    case 'added-kong':
      return `seat ${a.seat} added-kong ${a.tile} (${formatTile(a.tile)})`;
    case 'claim':
      return `seat ${a.seat} claim ${a.claim}` +
        (a.chowTiles ? ` with ${a.chowTiles.join('+')}` : '');
    case 'pass':
      return `seat ${a.seat} pass`;
  }
}

export function formatResult(r: HandResult | null): string {
  if (r === null) return 'none';
  if (r.type === 'draw-exhausted') return 'draw-exhausted (wall floor reached)';
  const lines = [
    `win by seat ${r.winner} (${r.by}` +
      (r.discarder !== null ? ` from seat ${r.discarder}` : '') +
      `) on ${r.winTile} (${formatTile(r.winTile)}) — ${r.tai} tai`,
    ...r.breakdown.map((b) => `      ${b.name.padEnd(8)} ${b.tai} tai`),
    `      payments ${r.payments.join(' / ')} (sum ${r.payments.reduce((a, b) => a + b, 0)})`,
  ];
  return lines.join('\n');
}

export function formatPlayer(s: GameState, seat: Seat): string {
  const p = s.players[seat];
  const marks = [
    seat === s.dealer ? 'DEALER' : '',
    seat === s.turn ? 'TURN' : '',
  ].filter(Boolean).join(' ');
  const held = p.hand.length + p.melds.reduce((n, m) => n + (m.type === 'kong' ? 3 : 3), 0);
  return [
    `  seat ${seat} (${seatWind(seat, s.dealer)}) ${marks}`,
    `    hand[${p.hand.length}]  ${formatTiles(p.hand)}`,
    `    melds     ${p.melds.length ? p.melds.map(formatMeld).join('  ') : '-'}`,
    `    flowers   ${formatTiles(p.flowers)}`,
    `    discards[${p.discards.length}] ${formatTiles(p.discards)}`,
    `    hand value ${held} (should be 16, or 17 while on turn)`,
  ].join('\n');
}

/** The whole state, top to bottom. This is what you paste into a bug report. */
export function formatState(s: GameState): string {
  const remaining = s.wallBack - s.wallFront + 1;
  const claims = s.pendingClaims;
  return [
    `GameState  seed=${s.seed}  variant=${s.variantId}`,
    `  phase=${s.phase}  turn=seat ${s.turn}  dealer=seat ${s.dealer} ` +
      `(streak ${s.dealerStreak})  round=${s.roundWind}  stakes=${s.rules.base}底/${s.rules.perTai}台`,
    `  wall  front=${s.wallFront} back=${s.wallBack} remaining=${remaining} (floor 16)`,
    `  flags drewThisTurn=${s.drewThisTurn} lastDrawn=${s.lastDrawnTile ?? '-'} ` +
      `replacementDraw=${s.lastDrawWasReplacement} kongRob=${s.wasKongRob} lastTile=${s.wasLastTile}`,
    `  lastDiscard  ${s.lastDiscard ? `${s.lastDiscard.tile} by seat ${s.lastDiscard.by}` : 'none'}`,
    `  pendingClaims ${claims
      ? `${claims.source} on ${claims.tile} from seat ${claims.from}; ` +
        `options ${claims.options.map((o) => `${o.seat}:${o.claim}`).join(',')}; ` +
        `answered ${Object.keys(claims.responses).join(',') || 'nobody'}`
      : 'none'}`,
    `  pendingKong  ${s.pendingKong ? `seat ${s.pendingKong.seat} ${s.pendingKong.tile}` : 'none'}`,
    ...([0, 1, 2, 3] as Seat[]).map((seat) => formatPlayer(s, seat)),
    `  result ${formatResult(s.result)}`,
  ].join('\n');
}

/** Who can do what, right now. */
export function formatLegalActions(s: GameState): string {
  const lines = ([0, 1, 2, 3] as Seat[]).flatMap((seat) => {
    const actions = legalActions(s, seat);
    if (actions.length === 0) return [];
    return [`  seat ${seat}: ${actions.map((a) => formatAction(a)).join(' | ')}`];
  });
  return lines.length ? lines.join('\n') : '  (nobody can act)';
}

function handValue(s: GameState, seat: Seat): number {
  return s.players[seat].hand.length + s.players[seat].melds.length * 3;
}

/**
 * Apply an action and describe what it changed, as data.
 *
 * The diff is the useful part: "seat 2 pung 3w" followed by "seat 2 hand 16→14,
 * +1 meld, seat 0 discards 1→0" tells you in one line whether the bookkeeping
 * was right, which stepping through a reducer would not.
 */
export function traceAction(before: GameState, action: Action): {
  next: GameState;
  log: string[];
} {
  const log = [`> ${formatAction(action)}`];
  let next: GameState;
  try {
    next = applyAction(before, action);
  } catch (error) {
    log.push(`  REJECTED: ${(error as Error).message}`);
    log.push(formatState(before));
    throw Object.assign(error as Error, { trace: log });
  }

  if (before.phase !== next.phase) log.push(`  phase ${before.phase} → ${next.phase}`);
  if (before.turn !== next.turn) log.push(`  turn seat ${before.turn} → seat ${next.turn}`);

  const wallBefore = before.wallBack - before.wallFront + 1;
  const wallAfter = next.wallBack - next.wallFront + 1;
  if (wallBefore !== wallAfter) log.push(`  wall ${wallBefore} → ${wallAfter}`);

  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const b = before.players[seat];
    const a = next.players[seat];
    const bits: string[] = [];
    if (b.hand.length !== a.hand.length) bits.push(`hand ${b.hand.length}→${a.hand.length}`);
    if (b.melds.length !== a.melds.length) {
      bits.push(`+meld ${a.melds.slice(b.melds.length).map(formatMeld).join(' ')}`);
    } else if (JSON.stringify(b.melds) !== JSON.stringify(a.melds)) {
      bits.push(`meld changed → ${a.melds.map(formatMeld).join(' ')}`);
    }
    if (b.discards.length !== a.discards.length) {
      bits.push(`discards ${b.discards.length}→${a.discards.length}`);
    }
    if (b.flowers.length !== a.flowers.length) {
      bits.push(`+flowers ${a.flowers.slice(b.flowers.length).join(' ')}`);
    }
    const hv = handValue(next, seat);
    if (hv !== 16 && hv !== 17) bits.push(`!! hand value ${hv}`);
    if (bits.length) log.push(`  seat ${seat}: ${bits.join(', ')}`);
  }

  if (next.result !== null && before.result === null) {
    log.push(`  RESULT ${formatResult(next.result)}`);
  }
  return { next, log };
}

/**
 * Play a hand to the end with a caller-supplied policy, returning the full
 * transcript. Feed the transcript into an assertion message and a failure tells
 * you the whole story instead of just the last line of it.
 */
export function traceHand(
  start: GameState,
  choose: (state: GameState, options: Action[], seat: Seat) => Action,
  maxSteps = 2000,
): { final: GameState; log: string[]; steps: number } {
  const log = [formatState(start)];
  let state = start;
  let steps = 0;
  while (state.phase !== 'finished') {
    if (++steps > maxSteps) {
      log.push(`  ABORTED: exceeded ${maxSteps} steps`);
      log.push(formatState(state));
      break;
    }
    const actors = ([0, 1, 2, 3] as Seat[]).filter((s) => legalActions(state, s).length > 0);
    if (actors.length === 0) {
      log.push('  DEADLOCK: no seat can act');
      log.push(formatState(state));
      break;
    }
    const seat = actors[0]!;
    const options = legalActions(state, seat);
    const { next, log: stepLog } = traceAction(state, choose(state, options, seat));
    log.push(...stepLog);
    state = next;
  }
  return { final: state, log, steps };
}
