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

  for (const ban of BANS) {
    it(`uses no ${ban.name}`, () => {
      const hits: string[] = [];
      for (const file of files) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          // Comments explain these rules; only real code may not break them.
          const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
          if (ban.pattern.test(code)) {
            hits.push(`${file.slice(SRC.length + 1)}:${i + 1}  ${line.trim()}`);
          }
        });
      }
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
    const testDir = join(SRC, '..', 'test');
    const banned = /\bvi\s*\.\s*(mock|fn|spyOn|stubGlobal|useFakeTimers)\b|\bjest\s*\.\s*mock\b/;
    const hits: string[] = [];
    for (const file of sourceFiles(testDir)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (banned.test(code)) hits.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(
      hits,
      `every test must drive the real engine with real tiles\n\n${hits.join('\n')}`,
    ).toEqual([]);
  });

  it('never skips a test', () => {
    const testDir = join(SRC, '..', 'test');
    const banned = /\b(it|test|describe)\s*\.\s*(skip|todo|only)\b|\bxit\b|\bxdescribe\b/;
    const hits: string[] = [];
    for (const file of sourceFiles(testDir)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (banned.test(code)) hits.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(hits, `a skipped test is a lie about coverage\n\n${hits.join('\n')}`).toEqual([]);
  });
});
