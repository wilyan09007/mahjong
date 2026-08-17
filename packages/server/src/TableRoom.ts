import { randomInt } from 'node:crypto';
import { Room, type Client } from '@colyseus/core';
import {
  IllegalActionError, applyAction, isSessionOver, legalActions, newHand, newSession,
  nextHandParams, viewFor,
  type Action, type GameState, type Seat, type SessionParams,
} from '@mahjong/engine';
import { chooseBotAction } from '@mahjong/bot';
import { generateRoomCode } from './roomCode.js';
import {
  C2S, DEFAULT_ROOM_CONFIG, S2C,
  type ActionMessage, type ConfigMessage, type EmoteMessage, type HandResultMessage,
  type JoinOptions, type LobbyMessage, type RoomConfig, type SeatKind, type SeatMessage,
  type SeatPublic, type SessionEndMessage,
} from './protocol.js';

/** A seat as the server knows it. `playerId` and `client` never leave here. */
interface SeatInternal {
  kind: SeatKind;
  playerId: string | null;
  name: string | null;
  connected: boolean;
  client: Client | null;
}

const SEATS: Seat[] = [0, 1, 2, 3];

/**
 * A private mahjong table.
 *
 * Deliberately NOT a Colyseus schema room. The authoritative `GameState` is a
 * plain object held here and never synchronised — every client instead receives
 * a `PlayerView` from `pushViews`. Colyseus schema sync broadcasts one shared
 * state to everyone, which is exactly what must not happen in a
 * hidden-information game. `pushViews` is the only place game data leaves this
 * process.
 *
 * Identity is by `playerId`, not by connection. That single decision is what
 * makes reconnection work: a dropped player's seat is held, a bot covers it
 * within `botDelayMs`, and rejoining with the same id reattaches to the seat.
 *
 * EVERY scheduled callback — bot moves, turn timers, claim timers, the pause
 * between hands — captures `generation` and returns if it has moved on. Without
 * that guard a bot timer armed before a human acted would fire afterwards and
 * play a move for a position that no longer exists.
 */
export class TableRoom extends Room {
  override maxClients = 4;

  private static readonly CODE_REGISTRY = '$mahjong_room_codes';

  seats: SeatInternal[] = SEATS.map(() => ({
    kind: 'empty',
    playerId: null,
    name: null,
    connected: false,
    client: null,
  }));

  config: RoomConfig = { ...DEFAULT_ROOM_CONFIG };
  hostPlayerId: string | null = null;

  game: GameState | null = null;
  session: SessionParams = newSession();
  scores: [number, number, number, number] = [0, 0, 0, 0];

  /** Bumped on every state transition; stale scheduled callbacks check it. */
  generation = 0;

  private lastEmoteAt = new Map<Seat, number>();

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

  override async onCreate(options: JoinOptions): Promise<void> {
    this.roomId = await this.reserveRoomCode();
    this.applyTestOverrides(options);
    this.registerHandlers();
  }

  /**
   * Claim an unused six-character code and use it as the Colyseus room id, so a
   * friend can `joinById('ABC234')` with nothing but the code. Uniqueness is
   * enforced against a presence set rather than hoped for: a duplicate would
   * silently route someone into the wrong game.
   */
  private async reserveRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateRoomCode();
      const taken = await this.presence.sismember(TableRoom.CODE_REGISTRY, code);
      if (!taken) {
        await this.presence.sadd(TableRoom.CODE_REGISTRY, code);
        return code;
      }
    }
    throw new Error('could not reserve a free room code after 10 attempts');
  }

  override async onDispose(): Promise<void> {
    await this.presence.srem(TableRoom.CODE_REGISTRY, this.roomId);
  }

  /**
   * Timing overrides for tests only. Gated on NODE_ENV so a real client cannot
   * shorten its own turn timer by sending the field.
   */
  private applyTestOverrides(options: JoinOptions | undefined): void {
    if (process.env['NODE_ENV'] !== 'test' || !options?.__test) return;
    this.config = { ...this.config, ...options.__test };
  }

  get inGame(): boolean {
    return this.game !== null;
  }

  // -------------------------------------------------------------------------
  // seats
  // -------------------------------------------------------------------------

  private seatOfPlayer(playerId: string): Seat | null {
    const i = this.seats.findIndex((s) => s.playerId === playerId);
    return i === -1 ? null : (i as Seat);
  }

  private seatOfClient(client: Client): Seat | null {
    const i = this.seats.findIndex((s) => s.client === client);
    return i === -1 ? null : (i as Seat);
  }

  private publicSeats(): SeatPublic[] {
    return this.seats.map((s, i) => ({
      seat: i as Seat,
      kind: s.kind,
      name: s.name,
      connected: s.connected,
    }));
  }

  broadcastLobby(): void {
    const message: LobbyMessage = {
      code: this.roomId,
      hostPlayerId: this.hostPlayerId,
      config: this.config,
      seats: this.publicSeats(),
    };
    this.broadcast(S2C.lobby, message);
  }

  private sendError(client: Client, message: string): void {
    client.send(S2C.error, { message });
  }

  private reassignHostIfNeeded(): void {
    if (this.hostPlayerId !== null) {
      const seat = this.seatOfPlayer(this.hostPlayerId);
      if (seat !== null && this.seats[seat]!.kind === 'human') return;
    }
    const next = this.seats.find((s) => s.kind === 'human' && s.connected);
    this.hostPlayerId = next?.playerId ?? null;
  }

  private isHost(client: Client): boolean {
    const seat = this.seatOfClient(client);
    return seat !== null && this.seats[seat]!.playerId === this.hostPlayerId;
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const playerId = options?.playerId;
    if (!playerId) {
      throw new Error('joining requires a playerId');
    }

    // Reconnection: the same player id reclaims the seat it already holds.
    const existing = this.seatOfPlayer(playerId);
    if (existing !== null) {
      const seat = this.seats[existing]!;
      seat.kind = 'human';
      seat.connected = true;
      seat.client = client;
      seat.name = options.name ?? seat.name;
      this.reassignHostIfNeeded();
      this.broadcastLobby();
      this.broadcast(S2C.seatStatus, { seat: existing, connected: true });
      // Hand them the current position immediately, so a rejoin is seamless
      // rather than "wait until someone moves".
      if (this.game) client.send(S2C.view, viewFor(this.game, existing));
      return;
    }

    const free = this.seats.findIndex((s) => s.kind === 'empty');
    if (free === -1) {
      throw new Error('this table is full');
    }
    this.seats[free] = {
      kind: 'human',
      playerId,
      name: options.name ?? 'Player',
      connected: true,
      client,
    };
    this.reassignHostIfNeeded();
    this.broadcastLobby();
  }

  override onLeave(client: Client): void {
    const seat = this.seatOfClient(client);
    if (seat === null) return;
    const s = this.seats[seat]!;
    s.connected = false;
    s.client = null;

    if (this.inGame) {
      // Mid-hand: hold the seat. A bot covers it and the player reattaches by
      // playerId. The other three never wait for them.
      this.broadcast(S2C.seatStatus, { seat, connected: false });
      this.scheduleAutoPlay();
    } else {
      // In the lobby there is nothing to preserve, so free the seat.
      this.seats[seat] = {
        kind: 'empty', playerId: null, name: null, connected: false, client: null,
      };
    }
    this.reassignHostIfNeeded();
    this.broadcastLobby();
  }

  // -------------------------------------------------------------------------
  // messages
  // -------------------------------------------------------------------------

  private registerHandlers(): void {
    this.onMessage(C2S.config, (client, message: ConfigMessage) => {
      if (!this.requireHostInLobby(client)) return;
      const next = { ...this.config };
      if (message?.totalRounds !== undefined) {
        if (![1, 2, 4].includes(message.totalRounds)) {
          this.sendError(client, 'totalRounds must be 1, 2 or 4');
          return;
        }
        next.totalRounds = message.totalRounds;
      }
      for (const key of ['base', 'perTai', 'turnSeconds', 'claimSeconds'] as const) {
        const value = message?.[key];
        if (value === undefined) continue;
        if (!Number.isFinite(value) || value < 0) {
          this.sendError(client, `${key} must be a non-negative number`);
          return;
        }
        next[key] = value;
      }
      this.config = next;
      this.broadcastLobby();
    });

    this.onMessage(C2S.fillBot, (client, message: SeatMessage) => {
      if (!this.requireHostInLobby(client)) return;
      const seat = this.validSeat(client, message);
      if (seat === null) return;
      if (this.seats[seat]!.kind !== 'empty') {
        this.sendError(client, `seat ${seat} is not empty`);
        return;
      }
      this.seats[seat] = {
        kind: 'bot', playerId: null, name: `Bot ${seat + 1}`, connected: true, client: null,
      };
      this.broadcastLobby();
    });

    this.onMessage(C2S.removeBot, (client, message: SeatMessage) => {
      if (!this.requireHostInLobby(client)) return;
      const seat = this.validSeat(client, message);
      if (seat === null) return;
      if (this.seats[seat]!.kind !== 'bot') {
        this.sendError(client, `seat ${seat} is not a bot`);
        return;
      }
      this.seats[seat] = {
        kind: 'empty', playerId: null, name: null, connected: false, client: null,
      };
      this.broadcastLobby();
    });

    this.onMessage(C2S.start, (client) => {
      if (!this.requireHostInLobby(client)) return;
      if (this.seats.some((s) => s.kind === 'empty')) {
        const empty = this.seats.filter((s) => s.kind === 'empty').length;
        this.sendError(
          client,
          `all 4 seats must be filled to start — ${empty} still empty ` +
            `(add a bot or wait for a friend)`,
        );
        return;
      }
      this.scores = [0, 0, 0, 0];
      this.session = newSession();
      this.startHand();
    });

    this.onMessage(C2S.action, (client, message: ActionMessage) => {
      const seat = this.seatOfClient(client);
      if (seat === null) {
        this.sendError(client, 'you are not seated at this table');
        return;
      }
      if (!this.game) {
        this.sendError(client, 'no hand is in progress');
        return;
      }
      const action = message?.action;
      if (!action || typeof action !== 'object') {
        this.sendError(client, 'action message must carry an action');
        return;
      }
      // Seat ownership: you may only ever play for yourself. This is the check
      // that stops a modified client from discarding out of an opponent's hand.
      if (action.seat !== seat) {
        this.sendError(
          client,
          `you are seat ${seat} and cannot play for seat ${action.seat}`,
        );
        client.send(S2C.view, viewFor(this.game, seat));
        return;
      }
      this.act(seat, action);
    });

    this.onMessage(C2S.emote, (client, message: EmoteMessage) => {
      const seat = this.seatOfClient(client);
      if (seat === null) return;
      const emote = message?.emote;
      if (typeof emote !== 'string' || emote.length === 0 || emote.length > 8) return;
      // One per second per seat: emotes are a spam surface, and there is no
      // free-text chat to moderate precisely because of that.
      const now = Date.now();
      if (now - (this.lastEmoteAt.get(seat) ?? 0) < 1000) return;
      this.lastEmoteAt.set(seat, now);
      this.broadcast(S2C.emote, { seat, emote });
    });
  }

  private requireHostInLobby(client: Client): boolean {
    if (!this.isHost(client)) {
      this.sendError(client, 'only the host can change the table');
      return false;
    }
    if (this.inGame) {
      this.sendError(client, 'the table is already playing');
      return false;
    }
    return true;
  }

  private validSeat(client: Client, message: SeatMessage): Seat | null {
    const seat = message?.seat;
    if (typeof seat !== 'number' || !SEATS.includes(seat as Seat)) {
      this.sendError(client, 'seat must be 0, 1, 2 or 3');
      return null;
    }
    return seat as Seat;
  }

  // -------------------------------------------------------------------------
  // game flow
  // -------------------------------------------------------------------------

  startHand(): void {
    // Real randomness for the seed is fine and desirable here — only the ENGINE
    // must be reproducible, and it is: given this seed it replays exactly.
    this.game = newHand({
      seed: randomInt(2 ** 31),
      dealer: this.session.dealer,
      dealerStreak: this.session.dealerStreak,
      roundWind: this.session.roundWind,
      rules: { base: this.config.base, perTai: this.config.perTai },
    });
    this.generation++;
    this.pushViews();
    this.scheduleAutoPlay();
  }

  /**
   * The only place game data leaves this process. Each seated human gets their
   * own filtered view; nobody gets `GameState`.
   */
  pushViews(): void {
    if (!this.game) return;
    for (const seat of SEATS) {
      const s = this.seats[seat]!;
      if (s.kind === 'human' && s.connected && s.client) {
        s.client.send(S2C.view, viewFor(this.game, seat));
      }
    }
  }

  act(seat: Seat, action: Action): void {
    if (!this.game) return;
    const before = this.game;
    try {
      this.game = applyAction(this.game, action);
    } catch (error) {
      if (error instanceof IllegalActionError) {
        // A rejected action means the client's picture is stale. Tell it why and
        // re-send the truth so it can heal rather than sit desynchronised.
        const client = this.seats[seat]!.client;
        if (client) {
          this.sendError(client, error.message);
          client.send(S2C.view, viewFor(before, seat));
        }
        return;
      }
      // Anything else is a server bug. Let it crash loudly rather than limp on
      // with a table nobody can diagnose.
      throw error;
    }

    this.generation++;
    if (this.game.phase === 'finished') {
      this.finishHand();
    } else {
      this.pushViews();
      this.scheduleAutoPlay();
    }
  }

  private finishHand(): void {
    const game = this.game;
    if (!game?.result) return;
    const result = game.result;

    if (result.type === 'win') {
      for (const seat of SEATS) this.scores[seat] += result.payments[seat];
    }
    this.pushViews();
    const message: HandResultMessage = { result, scores: [...this.scores] };
    this.broadcast(S2C.handResult, message);

    this.session = nextHandParams(this.session, result);

    if (isSessionOver(this.session, this.config.totalRounds)) {
      const standings: SessionEndMessage['standings'] = SEATS
        .map((seat) => ({
          seat,
          name: this.seats[seat]!.name ?? `Seat ${seat + 1}`,
          score: this.scores[seat],
        }))
        .sort((a, b) => b.score - a.score);
      this.broadcast(S2C.sessionEnd, { standings });
      // Back to the lobby with seats intact so the host can play again.
      this.game = null;
      this.generation++;
      this.broadcastLobby();
      return;
    }

    const generation = this.generation;
    this.clock.setTimeout(() => {
      if (generation !== this.generation) return;
      this.startHand();
    }, this.config.interHandMs);
  }

  // -------------------------------------------------------------------------
  // bots, timers, and covering for the disconnected
  // -------------------------------------------------------------------------

  /**
   * Arm whatever should happen without human input from this position: bot
   * seats move after `botDelayMs`, and a human who does not answer in time is
   * covered after `turnSeconds` / `claimSeconds`.
   *
   * Re-armed after EVERY transition. That matters in a claim window, where
   * several seats owe a response: the first response bumps `generation` and
   * invalidates the others' pending timers, and this call schedules fresh ones
   * for whoever still has not answered. Without the re-arm the window would
   * deadlock waiting on seats whose timers had gone stale.
   */
  private scheduleAutoPlay(): void {
    const game = this.game;
    if (!game || game.phase === 'finished') return;
    const generation = this.generation;

    for (const seat of SEATS) {
      const s = this.seats[seat]!;
      if (legalActions(game, seat).length === 0) continue;

      const botDriven = s.kind === 'bot' || (s.kind === 'human' && !s.connected);
      const delayMs = botDriven
        ? this.config.botDelayMs
        : (game.phase === 'awaiting-claims' ? this.config.claimSeconds : this.config.turnSeconds) * 1000;

      this.clock.setTimeout(() => {
        if (generation !== this.generation) return;
        const current = this.game;
        if (!current || current.phase === 'finished') return;
        if (legalActions(current, seat).length === 0) return;

        // A human who ran out of time passes on a claim rather than being made
        // to claim something they never chose; on their own turn the bot plays,
        // because a turn cannot be skipped.
        const action: Action =
          !botDriven && current.phase === 'awaiting-claims'
            ? { type: 'pass', seat }
            : chooseBotAction(viewFor(current, seat));
        this.act(seat, action);
      }, delayMs);
    }
  }
}
