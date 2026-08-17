import { Room, type Client } from '@colyseus/core';
import type { Seat } from '@mahjong/engine';
import { generateRoomCode } from './roomCode.js';
import {
  C2S, DEFAULT_ROOM_CONFIG, S2C,
  type ConfigMessage, type JoinOptions, type LobbyMessage, type RoomConfig,
  type SeatKind, type SeatMessage, type SeatPublic,
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
 * a `PlayerView`. Colyseus schema sync broadcasts one shared state to everyone,
 * which is exactly what must not happen in a hidden-information game.
 *
 * Identity is by `playerId`, not by connection. That single decision is what
 * makes reconnection work: a dropped player's seat is held, a bot covers it,
 * and rejoining with the same id reattaches to the same seat.
 *
 * Grows across Tasks 5-9 of Plan 2. Right now: room codes, seats, bots, host
 * controls.
 */
export class TableRoom extends Room {
  override maxClients = 4;

  /** Presence key holding every live room code, for collision-free codes. */
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

  override async onCreate(options: JoinOptions): Promise<void> {
    this.roomId = await this.reserveRoomCode();
    this.applyTestOverrides(options);
    this.registerLobbyHandlers();
  }

  /**
   * Claim an unused six-character code and use it as the Colyseus room id, so a
   * friend can `joinById('ABC234')` with nothing but the code.
   *
   * Uniqueness is enforced against a presence set rather than hoped for: a
   * duplicate would silently route someone into the wrong game.
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

  /** Host is the first connected human; it moves on if that human leaves. */
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

  /** True once a hand is running. Overridden in Task 6 when `game` exists. */
  protected get inGame(): boolean {
    return false;
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

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
      this.onSeatReattached(existing);
      this.broadcastLobby();
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
      // Mid-hand: hold the seat. A bot covers it (Task 7) and the player
      // reattaches by playerId. The other three never wait.
      this.onSeatDisconnected(seat);
    } else {
      // In the lobby there is nothing to preserve, so free the seat.
      this.seats[seat] = {
        kind: 'empty', playerId: null, name: null, connected: false, client: null,
      };
    }
    this.reassignHostIfNeeded();
    this.broadcastLobby();
  }

  /** Hooks Task 6-8 fill in; no-ops while only the lobby exists. */
  protected onSeatReattached(_seat: Seat): void {}
  protected onSeatDisconnected(_seat: Seat): void {}

  // -------------------------------------------------------------------------
  // lobby messages
  // -------------------------------------------------------------------------

  private registerLobbyHandlers(): void {
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
      this.onStartRequested();
    });
  }

  /** Task 6 replaces this with the real hand start. */
  protected onStartRequested(): void {}

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
}
