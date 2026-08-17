/**
 * Every string the user sees, in one place, so localisation later is a data
 * change rather than a hunt through components.
 */

export const strings = {
  appName: 'Mahjong with Friends',

  // Home
  yourName: 'Your name',
  namePlaceholder: 'Enter a name',
  createTable: 'Create table',
  joinTable: 'Join table',
  codePlaceholder: 'ABC234',
  codeHint: '6 characters, from your friend’s screen',
  invalidCode: 'That code should be 6 characters (letters and numbers).',
  /**
   * One message per thing the player can actually DO about it. "No such table"
   * has to cover a closed table too — a table full of four humans is
   * indistinguishable from a wrong code at the protocol level.
   */
  joinFailed: {
    'no-such-table': 'No table with that code. Check it with your friend — a table’s code stops working once everyone leaves.',
    'table-full': 'That table is full. Ask your friend to remove a bot to make room for you.',
    unreachable: 'Could not reach the server. Check your connection and try again.',
  },
  connectFailed: 'Could not reach the server. Check your connection and try again.',
  enterCodeManually: 'Enter a code',
  retry: 'Try again',

  // Lobby
  lobby: 'Table',
  roomCode: 'Room code',
  invite: 'Invite friends',
  inviteMessage: (code: string): string =>
    `Join my mahjong table! Code: ${code}\nmahjong://join/${code}`,
  addBot: 'Add bot',
  removeBot: 'Remove',
  emptySeat: 'Empty',
  waitingForHost: 'Waiting for the host to start…',
  start: 'Start game',
  startNeedsFour: 'All four seats must be filled',
  settings: 'Table settings',
  rounds: 'Rounds',
  turnTimer: 'Turn timer',
  basePoints: 'Base (底)',
  perTaiPoints: 'Per tai (台)',
  seconds: (n: number): string => `${n}s`,

  // Table
  wallRemaining: (n: number): string => `${n} left`,
  yourTurn: 'Your turn',
  chow: '吃',
  pung: '碰',
  kong: '槓',
  win: '胡',
  pass: 'Pass',
  discard: 'Discard',
  botCovering: '🤖 covering',
  disconnected: 'Disconnected',

  // Results
  handResult: 'Hand result',
  selfDraw: 'Self-draw',
  wonFrom: (name: string): string => `from ${name}`,
  exhaustiveDraw: 'Draw — the wall ran out',
  tai: (n: number): string => `${n} 台`,
  continueLabel: 'Continue',
  standings: 'Standings',
  playAgain: 'Play again',
  leave: 'Leave table',
  sessionComplete: 'Session complete',

  // Generic
  reconnecting: 'Reconnecting…',
  dismiss: 'Dismiss',
} as const;

/** The eight emotes. Fixed set — no free text, so there is nothing to moderate. */
export const EMOTES = ['👍', '😂', '😮', '😭', '🔥', '🎉', '🙏', '🤔'] as const;
