/**
 * Room-code input handling.
 *
 * People type codes off a photo of someone's screen, with spaces and dashes and
 * the wrong case. Normalise aggressively and only complain when the result
 * genuinely cannot be a code.
 */

export const CODE_LENGTH = 6;
/** Matches the server's alphabet: no I, O, 0 or 1. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normaliseCode(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, CODE_LENGTH);
}

export function isCompleteCode(input: string): boolean {
  const code = normaliseCode(input);
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}
