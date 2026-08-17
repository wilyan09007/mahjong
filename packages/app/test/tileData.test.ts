import { assertThat, assertEqual, assertAtLeast, assertAtMost } from './support';
import { FACE_DATA, VIEWBOX } from '../src/tiles/tileData';
import { FLOWERS, FULL_TILE_SET, NON_FLOWER_KINDS, type TileKind } from '@mahjong/engine';

describe('FACE_DATA', () => {
  it('covers exactly the 42 distinct tiles, with no extras', () => {
    const keys = Object.keys(FACE_DATA) as TileKind[];
    expect(keys).toHaveLength(42);
    expect(new Set(keys).size).toBe(42);
    for (const kind of [...NON_FLOWER_KINDS, ...FLOWERS]) {
      assertThat(FACE_DATA[kind] !== undefined, `no face defined for ${kind}`);
    }
    // And nothing invented that is not a real tile.
    const real = new Set<string>(FULL_TILE_SET);
    for (const key of keys) {
      assertThat(real.has(key), `${key} is not a real tile`);
    }
  });

  it('gives every dots tile exactly its rank in circles', () => {
    for (let rank = 1; rank <= 9; rank++) {
      const face = FACE_DATA[`${rank}t` as TileKind];
      assertEqual(face.kind, 'dots', `${rank}t should be a dots face`);
      if (face.kind !== 'dots') throw new Error('unreachable');
      assertEqual(face.circles.length, rank, `${rank}t has the wrong number of dots`);
    }
  });

  it('gives every bamboo tile exactly its rank in sticks', () => {
    for (let rank = 1; rank <= 9; rank++) {
      const face = FACE_DATA[`${rank}b` as TileKind];
      assertEqual(face.kind, 'bamboo', `${rank}b should be a bamboo face`);
      if (face.kind !== 'bamboo') throw new Error('unreachable');
      assertEqual(face.sticks.length, rank, `${rank}b has the wrong number of sticks`);
    }
  });

  it('renders characters as a numeral over 萬', () => {
    expect(FACE_DATA['1w']).toEqual({
      kind: 'glyph', chars: ['一', '萬'], colors: ['inkPrimary', 'suitRed'],
    });
    const nine = FACE_DATA['9w'];
    if (nine.kind !== 'glyph') throw new Error('expected glyph');
    expect(nine.chars).toEqual(['九', '萬']);
  });

  it('uses the traditional honour glyphs and colours', () => {
    const expected: Record<string, string> = {
      we: '東', ws: '南', ww: '西', wn: '北', dr: '中', dg: '發',
    };
    for (const [kind, glyph] of Object.entries(expected)) {
      const face = FACE_DATA[kind as TileKind];
      if (face.kind !== 'glyph') throw new Error(`${kind} should be a glyph`);
      assertEqual(face.chars[0], glyph, `${kind} has the wrong glyph`);
    }
    expect(FACE_DATA['dr']).toMatchObject({ colors: ['suitRed'] });
    expect(FACE_DATA['dg']).toMatchObject({ colors: ['suitGreen'] });
    // The white dragon is a bordered frame, not a character.
    expect(FACE_DATA['dw']).toEqual({ kind: 'frame' });
  });

  it('names the four gentlemen then the four seasons', () => {
    const glyphs = FLOWERS.map((f) => {
      const face = FACE_DATA[f];
      if (face.kind !== 'glyph') throw new Error(`${f} should be a glyph`);
      return face.chars[0];
    });
    expect(glyphs).toEqual(['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬']);
  });

  it('has no empty glyph and no colour missing its character', () => {
    for (const [kind, face] of Object.entries(FACE_DATA)) {
      if (face.kind !== 'glyph') continue;
      assertAtLeast(face.chars.length, 1, `${kind} has no characters`);
      assertEqual(
        face.colors.length, face.chars.length,
        `${kind} has ${face.colors.length} colours for ${face.chars.length} characters`,
      );
      for (const char of face.chars) {
        assertAtLeast(char.length, 1, `${kind} has an empty character`);
      }
    }
  });

  it('keeps every coordinate inside the viewBox', () => {
    for (const [kind, face] of Object.entries(FACE_DATA)) {
      if (face.kind === 'dots') {
        for (const c of face.circles) {
          assertAtLeast(c.cx - c.r, 0, `${kind} dot clips the left edge`);
          assertAtMost(c.cx + c.r, VIEWBOX.w, `${kind} dot clips the right edge`);
          assertAtLeast(c.cy - c.r, 0, `${kind} dot clips the top`);
          assertAtMost(c.cy + c.r, VIEWBOX.h, `${kind} dot clips the bottom`);
        }
      }
      if (face.kind === 'bamboo') {
        for (const s of face.sticks) {
          assertAtLeast(s.x, 1, `${kind} stick is off the left edge`);
          assertAtMost(s.x, VIEWBOX.w - 1, `${kind} stick is off the right edge`);
          assertAtLeast(s.y, 1, `${kind} stick is off the top`);
          assertAtMost(s.y, VIEWBOX.h - 1, `${kind} stick is off the bottom`);
        }
      }
    }
  });

  it('never overlaps two dots on the same tile', () => {
    for (const [kind, face] of Object.entries(FACE_DATA)) {
      if (face.kind !== 'dots') continue;
      for (let i = 0; i < face.circles.length; i++) {
        for (let j = i + 1; j < face.circles.length; j++) {
          const a = face.circles[i]!;
          const b = face.circles[j]!;
          const distance = Math.hypot(a.cx - b.cx, a.cy - b.cy);
          assertAtLeast(
            distance, a.r + b.r - 0.5,
            `${kind} dots ${i} and ${j} overlap`,
          );
        }
      }
    }
  });
});
