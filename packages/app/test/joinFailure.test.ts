import { MatchMakeError, ServerError, ErrorCode } from 'colyseus.js';
import { classifyJoinFailure } from '../src/net/connection';
import { JOIN_ERROR } from '../src/net/messages';
import { strings } from '../src/strings';

/**
 * A refused join has to say the right thing.
 *
 * The errors here are the real colyseus classes carrying the real codes, not
 * stand-ins: `packages/server/test/lobby.test.ts` pins each code against a
 * running server, and these are the same values arriving at the other end of
 * the socket. If the server's rejection shape changes, that suite fails first.
 */
describe('classifying a refused join', () => {
  it('reads an unknown room code as a bad code, not a network problem', () => {
    const error = new MatchMakeError(
      'room "ZZZZZZ" not found', ErrorCode.MATCHMAKE_INVALID_ROOM_ID,
    );
    expect(classifyJoinFailure(error)).toBe('no-such-table');
  });

  it('reads an expired reservation as a bad code', () => {
    const error = new MatchMakeError('expired', ErrorCode.MATCHMAKE_EXPIRED);
    expect(classifyJoinFailure(error)).toBe('no-such-table');
  });

  it('reads a bot-filled table as full', () => {
    const error = new ServerError(JOIN_ERROR.tableFull, 'this table is full');
    expect(classifyJoinFailure(error)).toBe('table-full');
  });

  it('falls back to unreachable for a transport failure', () => {
    // No code at all — the fetch never got an answer.
    expect(classifyJoinFailure(new Error('Network request failed')))
      .toBe('unreachable');
  });

  it('does not fall over on a non-Error rejection', () => {
    expect(classifyJoinFailure(null)).toBe('unreachable');
    expect(classifyJoinFailure(undefined)).toBe('unreachable');
    expect(classifyJoinFailure('nope')).toBe('unreachable');
  });

  it('has a distinct, actionable message for every case', () => {
    const messages = Object.values(strings.joinFailed);
    expect(new Set(messages).size).toBe(messages.length);

    // The point of the whole exercise: only the genuine transport failure is
    // allowed to send someone to their network settings.
    const blamesTheNetwork = messages.filter((m) => /connection/i.test(m));
    expect(blamesTheNetwork).toEqual([strings.joinFailed.unreachable]);
  });
});
