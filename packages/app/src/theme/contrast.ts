/**
 * WCAG relative-luminance contrast, for checking theme colours against each
 * other.
 *
 * This exists so "you can see it" is a rule a test can enforce rather than an
 * opinion. Faces and backs are large solid shapes on a coloured table, and the
 * failure mode is not subtle-but-ugly — a face-down tile at 1.23:1 against the
 * felt is genuinely invisible, and counting an opponent's hand is part of
 * playing.
 */

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    throw new Error(`expected a 6-digit hex colour, got ${JSON.stringify(hex)}`);
  }
  const r = channel(parseInt(clean.slice(0, 2), 16));
  const g = channel(parseInt(clean.slice(2, 4), 16));
  const b = channel(parseInt(clean.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 = identical, 21 = black on white. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
