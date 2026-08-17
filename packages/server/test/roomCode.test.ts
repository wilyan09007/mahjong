import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET, generateRoomCode, isValidRoomCode, normaliseRoomCode,
} from '../src/roomCode.js';

describe('generateRoomCode', () => {
  it('is six characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code, `${code} contains a character outside the alphabet`)
        .toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('omits the characters people misread', () => {
    for (const confusable of ['I', 'O', '0', '1']) {
      expect(ROOM_CODE_ALPHABET, `${confusable} should not be in the alphabet`)
        .not.toContain(confusable);
    }
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
  });

  it('is deterministic with an injected rng', () => {
    let n = 0;
    const fixed = (): number => ((n++ % 32) + 0.5) / 32;
    let m = 0;
    const same = (): number => ((m++ % 32) + 0.5) / 32;
    expect(generateRoomCode(fixed)).toBe(generateRoomCode(same));
  });

  it('practically never collides across 20k draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(generateRoomCode());
    // A handful of birthday collisions in 20k draws from ~1.07e9 codes would be
    // extraordinary; more than a few means the generator is not uniform.
    expect(20_000 - seen.size, `${20_000 - seen.size} collisions in 20k draws`)
      .toBeLessThan(3);
  });
});

describe('normaliseRoomCode', () => {
  it('accepts what a human actually types', () => {
    expect(normaliseRoomCode('ab 3d-ef')).toBe('AB3DEF');
    expect(normaliseRoomCode('  abcdef  ')).toBe('ABCDEF');
    expect(normaliseRoomCode('AB-3D-EF')).toBe('AB3DEF');
  });
});

describe('isValidRoomCode', () => {
  it('accepts generated codes and rejects malformed ones', () => {
    for (let i = 0; i < 100; i++) expect(isValidRoomCode(generateRoomCode())).toBe(true);
    expect(isValidRoomCode('ABCDE')).toBe(false);   // too short
    expect(isValidRoomCode('ABCDEFG')).toBe(false); // too long
    expect(isValidRoomCode('ABCDE0')).toBe(false);  // excluded character
    expect(isValidRoomCode('abcdef')).toBe(false);  // not uppercased
  });
});
