import { assertThat, assertEqual, assertAtLeast, assertAtMost } from './support';
import {
  FACE_DATA, MIN_STICK_ASPECT, STICK_NODE, STICK_W, VIEWBOX,
} from '../src/tiles/tileData';
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

  it('draws 條 as LINES, not dots', () => {
    // This is the whole visual difference between 條 and 筒. A stick that is
    // not decisively taller than it is wide makes 九條 read as 九筒 — which is
    // exactly the bug this test was written for.
    for (let rank = 1; rank <= 9; rank++) {
      const face = FACE_DATA[`${rank}b` as TileKind];
      if (face.kind !== 'bamboo') throw new Error(`${rank}b should be bamboo`);
      const aspect = face.stickHeight / STICK_W;
      assertAtLeast(
        aspect, MIN_STICK_ASPECT,
        `${rank}b sticks are ${face.stickHeight}x${STICK_W} (aspect ${aspect.toFixed(2)}) ` +
          `— too stubby to read as a line`,
      );
    }
  });

  it('node markings decorate a stick instead of severing it', () => {
    // The original art drew one node as an opaque ellipse 1.4x the stick's
    // width, which cut every 索 into two stubs and made 九條 read as 九筒.
    // A node must be narrower than the stick and a small fraction of its length.
    assertThat(
      STICK_NODE.widthRatio < 1,
      `a node ${STICK_NODE.widthRatio}x the stick width would spill over its edges`,
    );
    assertAtMost(
      STICK_NODE.heightRatio, 0.15,
      'a node this thick relative to the stick reads as a break, not a segment line',
    );
    assertAtMost(
      STICK_NODE.opacity, 0.7,
      'a near-opaque node erases the stick underneath it',
    );
    // And the nodes must not merge into one another or reach the stick's ends.
    const sorted = [...STICK_NODE.offsets].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      assertAtLeast(
        sorted[i]! - sorted[i - 1]!, STICK_NODE.heightRatio * 2,
        'adjacent nodes overlap into a single band',
      );
    }
    for (const offset of sorted) {
      assertAtMost(
        Math.abs(offset) + STICK_NODE.heightRatio / 2, 0.5,
        `a node at ${offset} runs off the end of the stick`,
      );
    }
  });

  it('never overlaps two sticks on the same tile', () => {
    for (const [kind, face] of Object.entries(FACE_DATA)) {
      if (face.kind !== 'bamboo') continue;
      for (let i = 0; i < face.sticks.length; i++) {
        for (let j = i + 1; j < face.sticks.length; j++) {
          const a = face.sticks[i]!;
          const b = face.sticks[j]!;
          const apart =
            Math.abs(a.x - b.x) >= STICK_W ||
            Math.abs(a.y - b.y) >= face.stickHeight;
          assertThat(
            apart,
            `${kind} sticks ${i} and ${j} overlap — ` +
              `centres (${a.x},${a.y}) and (${b.x},${b.y}), ` +
              `stick is ${STICK_W} wide by ${face.stickHeight} tall`,
          );
        }
      }
    }
  });

  it('keeps whole sticks inside the tile, ends included', () => {
    for (const [kind, face] of Object.entries(FACE_DATA)) {
      if (face.kind !== 'bamboo') continue;
      const half = face.stickHeight / 2;
      for (const s of face.sticks) {
        assertAtLeast(s.x - STICK_W / 2, 0, `${kind} stick clips the left edge`);
        assertAtMost(s.x + STICK_W / 2, VIEWBOX.w, `${kind} stick clips the right edge`);
        assertAtLeast(s.y - half, 0, `${kind} stick clips the top`);
        assertAtMost(s.y + half, VIEWBOX.h, `${kind} stick clips the bottom`);
      }
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
