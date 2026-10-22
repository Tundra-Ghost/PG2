import { randomInt, randomUUID } from 'node:crypto';
import {
  buildMove,
  chessEngine,
  createOnlineDraft,
  draftFinish,
  draftPick,
  drawByAgreement,
  isDraftComplete,
  resign,
  isPromotionMove,
  toWire,
  MAX_CHAT_CHARS,
  type ActionAck,
  type ChatMessage,
  type Color,
  type DrawOfferRequest,
  type GameSummary,
  type SeatRef,
  type GameState,
  type MoveRequest,
  type OnlineDraft,
  type RoomAck,
  type RoomSnapshot,
  type SeatStatus,
} from '@pigeon-chess/game-core';
import { MemoryStore, type RoomStore } from './store';

/** Unambiguous characters only, so a code read aloud or retyped still works. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

/** A signed-in player. Guests have none. */
export interface Player {
  id: string;
  username: string;
}

interface Seat {
  token: string;
  connected: boolean;
  /** The account holding this seat. They can reclaim it from any device. */
  player?: Player;
}

export interface Room {
  id: string;
  state: GameState;
  seats: Partial<Record<Color, Seat>>;
  /** The side with an open draw offer. Cleared by any move. */
  drawOffer: Color | null;
  /** Last time anything happened in the room (ms since epoch). */
  updatedAt: number;
  /** Most recent chat, oldest first. */
  chat: ChatMessage[];
  /** The modifier draft, or null for a standard game. */
  draft: OnlineDraft | null;
}

/** Chat kept per room. Older lines drop off. */
export const CHAT_HISTORY = 100;
/** Messages one seat may send per CHAT_WINDOW_MS. */
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5000;

const DRAFT_RUNNING = 'Finish the modifier draft first.';

function drafting(room: Room): boolean {
  return room.draft !== null && !isDraftComplete(room.draft);
}

/** Same start as a local drafted match: each pick belongs to the side that drafted it. */
function startDraftedGame(draft: OnlineDraft): GameState {
  const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
    ...draft.picks.white.map(id => ({ id, sourceColor: 'white' as const })),
    ...draft.picks.black.map(id => ({ id, sourceColor: 'black' as const })),
  ]);
  return chessEngine.beginTurn(state);
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
  private chatTimes = new Map<string, number[]>();

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

  create(player?: Player, opts: { draft?: boolean } = {}): RoomAck {
    const id = this.newRoomId();
    const token = randomUUID();
    const room: Room = {
      id,
      state: chessEngine.beginTurn(chessEngine.getInitialState()),
      seats: { white: { token, connected: true, ...(player ? { player } : {}) } },
      drawOffer: null,
      updatedAt: this.now(),
      chat: [],
      draft: opts.draft ? createOnlineDraft() : null,
    };
    this.rooms.set(id, room);
    this.store.save(room);
    return { ok: true, roomId: id, color: 'white', token };
  }

  /**
   * Reclaims a seat by its token or, for a signed-in player, by their account.
   * Otherwise takes the open black seat.
   */
  join(rawRoomId: string, token?: string, player?: Player): RoomAck {
    const room = this.rooms.get(rawRoomId.trim().toUpperCase());
    if (!room) return { ok: false, reason: 'No room with that code.' };

    for (const color of ['white', 'black'] as const) {
      const seat = room.seats[color];
      if (!seat) continue;
      const byToken = Boolean(token) && seat.token === token;
      const byAccount = player !== undefined && seat.player?.id === player.id;
      if (!byToken && !byAccount) continue;
      seat.connected = true;
      if (player && !seat.player) {
        seat.player = player;
        this.store.save(room);
      }
      return { ok: true, roomId: room.id, color, token: seat.token };
    }

    if (room.seats.black) return { ok: false, reason: 'That room is full.' };
    const seatToken = randomUUID();
    room.seats.black = { token: seatToken, connected: true, ...(player ? { player } : {}) };
    this.touch(room);
    return { ok: true, roomId: room.id, color: 'black', token: seatToken };
  }

  move(roomId: string, color: Color, req: MoveRequest): ActionAck {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    if (!room.seats.black) return { ok: false, reason: 'Waiting for an opponent.' };
    if (drafting(room)) return { ok: false, reason: DRAFT_RUNNING };

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
    if (drafting(room)) return { ok: false, reason: DRAFT_RUNNING };
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
    if (drafting(room)) return { ok: false, reason: DRAFT_RUNNING };
    if (room.state.status !== 'active') return { ok: false, reason: 'The game is over.' };
    return { ok: true, room };
  }

  /** A seat drafts a modifier. The game starts once both drafts are done. */
  draftPick(roomId: string, color: Color, modifierId: unknown): ActionAck {
    return this.draftAction(roomId, draft => draftPick(draft, color, String(modifierId ?? '')));
  }

  draftFinish(roomId: string, color: Color): ActionAck {
    return this.draftAction(roomId, draft => draftFinish(draft, color));
  }

  private draftAction(
    roomId: string,
    step: (draft: OnlineDraft) => { ok: true; draft: OnlineDraft } | { ok: false; error: string },
  ): ActionAck {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    if (!room.draft) return { ok: false, reason: 'This game has no draft.' };
    if (!drafting(room)) return { ok: false, reason: 'The draft is over.' };
    if (!room.seats.black) return { ok: false, reason: 'Waiting for an opponent.' };
    const result = step(room.draft);
    if (!result.ok) return { ok: false, reason: result.error };
    room.draft = result.draft;
    if (isDraftComplete(room.draft)) room.state = startDraftedGame(room.draft);
    this.touch(room);
    return { ok: true };
  }

  /** Adds a chat line from a seated player. Saved with the room, but doesn't count as game activity. */
  chat(roomId: string, color: Color, rawText: unknown): { ok: true; message: ChatMessage } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'Room closed.' };
    // Control characters could break the log layout; collapse runs of whitespace.
    const text = (typeof rawText === 'string' ? rawText : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return { ok: false, reason: 'Say something first.' };
    if (text.length > MAX_CHAT_CHARS) return { ok: false, reason: `Keep messages under ${MAX_CHAT_CHARS} characters.` };

    const key = `${roomId}:${color}`;
    const now = this.now();
    const recent = (this.chatTimes.get(key) ?? []).filter(at => now - at < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) return { ok: false, reason: 'Slow down a little.' };
    recent.push(now);
    this.chatTimes.set(key, recent);

    const message: ChatMessage = {
      id: randomUUID(),
      color,
      author: room.seats[color]?.player?.username ?? (color === 'white' ? 'White' : 'Black'),
      text,
      ply: room.state.moveHistory.length,
      at: now,
    };
    room.chat = [...room.chat, message].slice(-CHAT_HISTORY);
    this.store.save(room);
    return { ok: true, message };
  }

  chatHistory(roomId: string): ChatMessage[] {
    return this.rooms.get(roomId)?.chat ?? [];
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

  /**
   * Summaries for the seats a browser remembers, plus, for a signed-in
   * player, every game their account sits in. Remembered seats nobody owns
   * yet are linked to that player. A wrong token reveals nothing.
   */
  summaries(seats: SeatRef[], player?: Player): GameSummary[] {
    const found = new Map<string, { room: Room; color: Color }>();
    for (const ref of seats.slice(0, 50)) {
      const room = this.rooms.get(String(ref?.roomId ?? '').toUpperCase());
      if (!room) continue;
      const color = (['white', 'black'] as const).find(c => room.seats[c]?.token === ref.token);
      if (!color) continue;
      const seat = room.seats[color]!;
      if (player && !seat.player) {
        seat.player = player;
        this.store.save(room);
      }
      found.set(room.id, { room, color });
    }
    if (player) {
      for (const room of this.rooms.values()) {
        const color = (['white', 'black'] as const).find(c => room.seats[c]?.player?.id === player.id);
        if (color && !found.has(room.id)) found.set(room.id, { room, color });
      }
    }
    return [...found.values()].map(({ room, color }) => ({
      roomId: room.id,
      color,
      turn: room.state.turn,
      status: room.state.status,
      opponentJoined: Boolean(room.seats.white && room.seats.black),
      opponentName: room.seats[color === 'white' ? 'black' : 'white']?.player?.username ?? null,
      moveCount: room.state.moveHistory.length,
      updatedAt: room.updatedAt,
    }));
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
      names: {
        white: room.seats.white?.player?.username ?? null,
        black: room.seats.black?.player?.username ?? null,
      },
      draft: room.draft,
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
