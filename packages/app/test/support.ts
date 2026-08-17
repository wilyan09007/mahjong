/**
 * Loud assertions for Jest.
 *
 * Jest's `expect(value)` takes no message argument (Vitest's does), so a
 * failure deep inside a loop over 42 tiles reports "expected 5, got 4" with no
 * clue WHICH tile. These helpers put the subject in the failure message, which
 * is the difference between a useful failure and a puzzle.
 */

export function assertThat(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function assertAtLeast(actual: number, minimum: number, message: string): void {
  if (!(actual >= minimum)) {
    throw new Error(`${message} — expected at least ${minimum}, got ${actual}`);
  }
}

export function assertAtMost(actual: number, maximum: number, message: string): void {
  if (!(actual <= maximum)) {
    throw new Error(`${message} — expected at most ${maximum}, got ${actual}`);
  }
}
