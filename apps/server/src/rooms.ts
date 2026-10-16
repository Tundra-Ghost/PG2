import { randomInt, randomUUID } from 'node:crypto';
import {
  buildMove,
  chessEngine,
  drawByAgreement,
  resign,
  isPromotionMove,
  toWire,
  type ActionAck,
  type Color,
  type DrawOfferRequest,
  type GameSummary,
  type SeatRef,
  type GameState,
  type MoveRequest,
  type RoomAck,
  type RoomSnapshot,
  type SeatStatus,
} from '@pigeon-chess/game-core';
import { MemoryStore, type RoomStore } from './store';

/** Unambiguous characters only, so a code read aloud or retyped still works. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

interface Seat {
  token: string;
  connected: boolean;
}

export interface Room {
  id: string;
  state: GameState;
  seats: Partial<Record<Color, Seat>>;
  /** The side with an open draw offer. Cleared by any move. */
  drawOffer: Color | null;
  /** Last time anything happened in the room (ms since epoch). */
  updatedAt: number;
}

/** A room nobody has touched for this long is deleted. */
export const ROOM_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Live rooms, backed by a RoomStore so games survive a server restart or
 * sleep and can be finished over several days.
 * Every rule decision goes through game-core. Clients only send intents.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private readonly store: RoomStore = new MemoryStore(),
    private readonly now: () => number = Date.now,
  ) {
    for (const room of store.loadAll()) this.rooms.set(room.id, room);
    this.expireOld();
  }

  /** Deletes rooms idle longer than ROOM_EXPIRY_MS. */
  expireOld(): void {
    const cutoff = this.now() - ROOM_EXPIRY_MS;
    for (const room of this.rooms.values()) {
      if (room.updatedAt >= cutoff) continue;
      this.rooms.delete(room.id);
      this.store.remove(room.id);
    }
  }

  private touch(room: Room): void {
    room.updatedAt = this.now();
    this.store.save(room);
  }

  create(): RoomAck {
    const id = this.newRoomId();
    const token = randomUUID();
    const room: Room = {
      id,
      state: chessEngine.beginTurn(chessEngine.getInitialState()),
      seats: { white: { token, connected: true } },
      drawOffer: null,
      updatedAt: this.now(),
    };
    this.rooms.set(id, room);
    this.store.save(room);
    return { ok: true, roomId: id, color: 'white', token };
  }

  /** Takes the open black seat, or reclaims a seat with its token. */
  join(rawRoomId: string, token?: string): RoomAck {
    const room = this.rooms.get(rawRoomId.trim().toUpperCase());
    if (!room) return { ok: false, reason: 'No room with that code.' };

    if (token) {
      for (const color of ['white', 'black'] as const) {
        const seat = room.seats[color];
        if (seat?.token === token) {
          seat.connected = true;
          return { ok: true, roomId: room.id, color, token };
        }
      }
    }

    if (room.seats.black) return { ok: false, reason: 'That room is full.' };
    const seatToken = randomUUID();
    room.seats.black = { token: seatToken, connected: true };
    this.touch(room);
    return { ok: true, roomId: room.id, color: 'black', token: seatToken };
  }

  move(roomId: string, color: Color, req: MoveRequest): ActionAck {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    if (!room.seats.black) return { ok: false, reason: 'Waiting for an opponent.' };

    // The seat decides the colour, never the client payload.
    const state = room.state;
    const move = { ...buildMove(state, req.from, req.to), playerColor: color };
    if (isPromotionMove(state, req.from, req.to)) {
      if (!req.promotion) return { ok: false, reason: 'Choose a promotion piece.' };
      move.promotion = req.promotion;
    }

    const validation = chessEngine.validateMove(state, move);
    if (!validation.valid) return { ok: false, reason: validation.reason ?? 'Illegal move.' };

    room.state = chessEngine.applyMove(state, move);
    room.drawOffer = null;
    this.touch(room);
    return { ok: true };
  }

  shooGerald(roomId: string, color: Color): ActionAck {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    if (room.state.turn !== color) return { ok: false, reason: 'not your turn' };
    if (!chessEngine.canShooGerald(room.state)) return { ok: false, reason: 'Gerald cannot be shooed right now.' };
    room.state = chessEngine.shooGerald(room.state);
    room.drawOffer = null;
    this.touch(room);
    return { ok: true };
  }

  resign(roomId: string, color: Color): ActionAck {
    const room = this.activeRoom(roomId);
    if (!room.ok) return room;
    room.room.state = resign(room.room.state, color);
    room.room.drawOffer = null;
    this.touch(room.room);
    return { ok: true };
  }

  /** TDD §05 draw flow: offer, accept, or decline (see DrawOfferRequest). */
  drawOffer(roomId: string, color: Color, req: DrawOfferRequest): ActionAck {
    const found = this.activeRoom(roomId);
    if (!found.ok) return found;
    const room = found.room;
    const opponentOffered = room.drawOffer !== null && room.drawOffer !== color;

    if (req.accept === false) {
      if (!opponentOffered) return { ok: false, reason: 'There is no draw offer to decline.' };
      room.drawOffer = null;
      this.touch(room);
      return { ok: true };
    }
    if (req.accept === true && !opponentOffered) {
      return { ok: false, reason: 'There is no draw offer to accept.' };
    }
    if (opponentOffered) {
      room.state = drawByAgreement(room.state);
      room.drawOffer = null;
      this.touch(room);
      return { ok: true };
    }
    if (room.drawOffer === color) return { ok: false, reason: 'You already offered a draw.' };
    room.drawOffer = color;
    this.touch(room);
    return { ok: true };
  }

  private activeRoom(roomId: string): { ok: true; room: Room } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    if (!room.seats.black) return { ok: false, reason: 'Waiting for an opponent.' };
    if (room.state.status !== 'active') return { ok: false, reason: 'The game is over.' };
    return { ok: true, room };
  }

  setConnected(roomId: string, color: Color, connected: boolean): void {
    const seat = this.rooms.get(roomId)?.seats[color];
    if (seat) seat.connected = connected;
  }

  /**
   * Drops a room once nobody is left in it, but only if it can't be resumed:
   * a room that never got an opponent. Started games wait for their players
   * until they expire.
   */
  closeIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const anyone = Object.values(room.seats).some(seat => seat?.connected);
    if (anyone || room.seats.black) return;
    this.rooms.delete(roomId);
    this.store.remove(roomId);
  }

  /** Summaries for the seats a browser remembers. A wrong token reveals nothing. */
  summaries(seats: SeatRef[]): GameSummary[] {
    const games: GameSummary[] = [];
    for (const ref of seats.slice(0, 50)) {
      const room = this.rooms.get(String(ref?.roomId ?? '').toUpperCase());
      if (!room) continue;
      const color = (['white', 'black'] as const).find(c => room.seats[c]?.token === ref.token);
      if (!color) continue;
      games.push({
        roomId: room.id,
        color,
        turn: room.state.turn,
        status: room.state.status,
        opponentJoined: Boolean(room.seats.white && room.seats.black),
        moveCount: room.state.moveHistory.length,
        updatedAt: room.updatedAt,
      });
    }
    return games;
  }

  snapshot(roomId: string): RoomSnapshot | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const seatStatus = (seat?: Seat): SeatStatus =>
      !seat ? 'empty' : seat.connected ? 'connected' : 'disconnected';
    return {
      roomId: room.id,
      seats: { white: seatStatus(room.seats.white), black: seatStatus(room.seats.black) },
      state: toWire(room.state),
      drawOffer: room.drawOffer,
    };
  }

  private newRoomId(): string {
    for (;;) {
      let id = '';
      for (let i = 0; i < CODE_LENGTH; i += 1) id += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(id)) return id;
    }
  }
}
