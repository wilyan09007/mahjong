/**
 * Six-character join codes.
 *
 * The alphabet omits I, O, 0 and 1 on purpose: a code gets read aloud across a
 * room or typed off a photo of someone's screen, and those four are the pairs
 * people get wrong. 32 usable characters gives 32^6 ≈ 1.07 billion codes, which
 * is ample for a server that only ever holds a few hundred live rooms.
 *
 * The server is allowed real randomness — only the ENGINE must stay seeded and
 * reproducible — but the rng is injectable so tests can force a collision.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalise user input: strip spaces and dashes, uppercase. */
export function normaliseRoomCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}
