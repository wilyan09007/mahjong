import { normaliseCode, isCompleteCode, CODE_LENGTH } from '../src/state/codeInput';
import { assertThat } from './support';

describe('normaliseCode', () => {
  it('accepts what people actually type', () => {
    expect(normaliseCode('ab 3d-ef')).toBe('AB3DEF');
    expect(normaliseCode('  abcdef ')).toBe('ABCDEF');
    expect(normaliseCode('AB-3D-EF')).toBe('AB3DEF');
    expect(normaliseCode('a')).toBe('A');
  });

  it('never exceeds the code length, however much is pasted', () => {
    expect(normaliseCode('ABCDEFGHIJ')).toHaveLength(CODE_LENGTH);
  });

  it('is idempotent', () => {
    const once = normaliseCode('ab 3d-ef');
    expect(normaliseCode(once)).toBe(once);
  });
});

describe('isCompleteCode', () => {
  it('accepts a well-formed code', () => {
    expect(isCompleteCode('ABC234')).toBe(true);
    expect(isCompleteCode('abc234')).toBe(true);
    // Punctuation is noise, not content: this is still exactly six characters.
    expect(isCompleteCode('AB C-234')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isCompleteCode('ABC23')).toBe(false);
    expect(isCompleteCode('')).toBe(false);
  });

  it('rejects the characters the server never issues', () => {
    for (const confusable of ['I', 'O', '0', '1']) {
      assertThat(
        !isCompleteCode(`ABC23${confusable}`),
        `${confusable} should not be a valid code character`,
      );
    }
  });
});
