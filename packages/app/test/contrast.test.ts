import { assertAtLeast, assertThat } from './support';
import { contrastRatio, relativeLuminance } from '../src/theme/contrast';
import { tokens } from '../src/theme/tokens';

/**
 * Theme legibility, as rules rather than opinions.
 *
 * Written after a real bug: `tileBack` scored 1.23:1 against `tableFelt`, so an
 * opponent's 16 face-down tiles rendered as a single green smear on the table
 * and could not be counted — and counting an opponent's hand is part of playing.
 * Nothing in the type system or the unit tests could notice that.
 */

const { color } = tokens;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour against itself', () => {
    expect(Math.round(contrastRatio('#000000', '#FFFFFF'))).toBe(21);
    expect(contrastRatio('#175E43', '#175E43')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#175E43', '#F6F1E7'))
      .toBeCloseTo(contrastRatio('#F6F1E7', '#175E43'), 10);
  });

  it('rejects a malformed colour rather than scoring it', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(/6-digit/);
  });
});

describe('theme legibility', () => {
  it('a face-down tile is clearly visible on the table', () => {
    assertAtLeast(
      contrastRatio(color.tileBack, color.tableFelt), 2.5,
      `tileBack ${color.tileBack} on tableFelt ${color.tableFelt} — opponents' ` +
        `concealed tiles would blur into the table and could not be counted`,
    );
  });

  it('a face-down tile cannot be mistaken for a face-up one', () => {
    assertAtLeast(
      contrastRatio(color.tileBack, color.tileFace), 2,
      `tileBack ${color.tileBack} vs tileFace ${color.tileFace} — a back must ` +
        `read as a back at a glance`,
    );
  });

  it('a face-up tile stands off the table', () => {
    assertAtLeast(
      contrastRatio(color.tileFace, color.tableFelt), 4,
      'tiles must sit clearly on top of the felt',
    );
  });

  it('tile ink is readable on the tile face', () => {
    for (const ink of ['inkPrimary', 'suitRed', 'suitGreen', 'suitBlue'] as const) {
      assertAtLeast(
        contrastRatio(color[ink], color.tileFace), 4.5,
        `${ink} ${color[ink]} on the tile face is too faint to read at 22px`,
      );
    }
  });

  it('text on the felt is readable', () => {
    assertAtLeast(
      contrastRatio(color.textOnFelt, color.tableFelt), 4.5,
      'primary text on the table must meet normal-text contrast',
    );
    assertAtLeast(
      contrastRatio(color.textMuted, color.tableFelt), 3,
      'even muted text has to be legible on the felt',
    );
  });

  it('the gold accent reads on every surface it is used on', () => {
    for (const surface of ['tableFelt', 'surface', 'surfaceRaised'] as const) {
      assertAtLeast(
        contrastRatio(color.accentGold, color[surface]), 3,
        `accentGold on ${surface} — it marks the selected tile and the turn, ` +
          `so it has to be obvious`,
      );
    }
  });

  it('every colour token is a well-formed hex or an rgba string', () => {
    for (const [name, value] of Object.entries(color)) {
      assertThat(
        /^#[0-9A-Fa-f]{6}$/.test(value) || value.startsWith('rgba('),
        `token ${name} = ${value} is neither a 6-digit hex nor rgba()`,
      );
    }
  });
});
