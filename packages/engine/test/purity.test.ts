import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Enforces the engine's defining constraint, which until now was only written
 * down in CLAUDE.md: **the engine is pure.** No I/O, no clock, no ambient
 * randomness. Those rules are what make a hand reproducible from its seed, and
 * a rule nothing checks is a rule that quietly stops being true.
 *
 * This reads the real source tree — no mocks, no fixtures. If it fails, the
 * message names the file, the line and the offending text.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * Split on either line ending, ALWAYS.
 *
 * Git checks this repo out with CRLF on Windows. Splitting on '\n' alone
 * leaves a trailing '\r' on every line, and in a JavaScript regex `\r` is a
 * line terminator, so `.` refuses to match it and `/^\s*\*.*$/` silently stops
 * recognising comment lines. Every comment that *documents* a banned call then
 * reads as a violation of it. That is how this guard reported wall.ts's own
 * "Math.random() is banned everywhere" docstring as banned code.
 */
function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Blank out comments so a rule may be discussed in prose without tripping
 * itself. Handles `//` line comments and `*` continuation lines of a block.
 */
export function stripComments(line: string): string {
  // Drop a trailing \r FIRST. `.` will not match a carriage return and `$`
  // will not sit before one, so on a CRLF line every pattern below silently
  // stops matching. Doing it here rather than only in `lines()` means the
  // function is correct however it is called.
  return line.replace(/\r$/, '').replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
}

/** Lines of real code in `file` that match `pattern`, as `path:line  text`. */
function violations(file: string, label: string, pattern: RegExp): string[] {
  const out: string[] = [];
  lines(readFileSync(file, 'utf8')).forEach((line, i) => {
    if (pattern.test(stripComments(line))) out.push(`${label}:${i + 1}  ${line.trim()}`);
  });
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

interface Ban {
  name: string;
  pattern: RegExp;
  why: string;
}

const BANS: Ban[] = [
  {
    name: 'Math.random',
    pattern: /\bMath\s*\.\s*random\b/,
    why: 'randomness must come from mulberry32 in wall.ts, or a hand stops being replayable from its seed',
  },
  {
    name: 'Date / clock',
    pattern: /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\s*\.\s*now\b/,
    why: 'a clock makes the same seed produce different results',
  },
  {
    name: 'console',
    pattern: /\bconsole\s*\./,
    why: 'the engine does no I/O — return a string from debug.ts and let the caller decide where it goes',
  },
  {
    name: 'process / env',
    pattern: /\bprocess\s*\.\s*(env|argv|exit|stdout|stderr)\b/,
    why: 'engine behaviour must not depend on the environment it runs in',
  },
  {
    name: 'node builtins',
    pattern: /from\s+['"](node:|fs|path|os|http|https|net|crypto|child_process)['"]/,
    why: 'the engine has zero runtime dependencies and must run unchanged in a React Native bundle',
  },
  {
    name: 'timers',
    pattern: /\bsetTimeout\b|\bsetInterval\b|\bqueueMicrotask\b/,
    why: 'applyAction is synchronous and total; nothing may be deferred',
  },
];

describe('engine purity', () => {
  const files = sourceFiles(SRC);

  it('finds the source tree', () => {
    expect(files.length, `no .ts files found under ${SRC}`).toBeGreaterThan(10);
  });

  it('strips comments regardless of line ending', () => {
    // Regression: with CRLF checkouts the trailing \r defeated /^\s*\*.*$/,
    // so a comment describing a banned call was read as the call itself.
    const comment = ' * `Math.random()` is banned everywhere in this package';
    expect(stripComments(comment)).toBe('');
    expect(stripComments(`${comment}\r`)).toBe('');
    expect(stripComments('// Math.random() would be wrong here\r')).toBe('');
    // Real code must still survive stripping, or the guard checks nothing.
    expect(stripComments('const x = Math.random();\r')).toContain('Math.random');
  });

  for (const ban of BANS) {
    it(`uses no ${ban.name}`, () => {
      const hits = files.flatMap((file) =>
        violations(file, file.slice(SRC.length + 1), ban.pattern));
      expect(hits, `${ban.why}\n\n${hits.join('\n')}`).toEqual([]);
    });
  }

  it('declares no runtime dependencies', () => {
    const pkg = JSON.parse(
      readFileSync(join(SRC, '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies ?? {}).toEqual({});
  });

  it('contains no test doubles — this suite mocks nothing', () => {
    const banned = /\bvi\s*\.\s*(mock|fn|spyOn|stubGlobal|useFakeTimers)\b|\bjest\s*\.\s*mock\b/;
    const hits = sourceFiles(join(SRC, '..', 'test'))
      .flatMap((file) => violations(file, file, banned));
    expect(
      hits,
      `every test must drive the real engine with real tiles\n\n${hits.join('\n')}`,
    ).toEqual([]);
  });

  it('never skips a test', () => {
    const banned = /\b(it|test|describe)\s*\.\s*(skip|todo|only)\b|\bxit\b|\bxdescribe\b/;
    const hits = sourceFiles(join(SRC, '..', 'test'))
      .flatMap((file) => violations(file, file, banned));
    expect(hits, `a skipped test is a lie about coverage\n\n${hits.join('\n')}`).toEqual([]);
  });
});
