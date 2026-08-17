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
  connectFailed: 'Could not reach the table. Check your connection and try again.',
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
