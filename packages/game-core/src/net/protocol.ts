import type { Color, GameState, PieceType, Square } from '../engine/types';
import type { WireGameState } from './wire';

/**
 * Socket.IO contract between web and server (TDD §05).
 * The client only sends intents. The server validates with game-core and
 * broadcasts the resulting state. The client never applies its own move.
 */

export type SeatStatus = 'empty' | 'connected' | 'disconnected';

export interface RoomSnapshot {
  roomId: string;
  seats: Record<Color, SeatStatus>;
  state: WireGameState;
  /** The side with an open draw offer, if any. Any move clears it. */
  drawOffer: Color | null;
  /** Account usernames per seat. Null for an empty seat or a guest. */
  names: Record<Color, string | null>;
}

export type RoomAck =
  | { ok: true; roomId: string; color: Color; token: string }
  | { ok: false; reason: string };

export type ActionAck = { ok: true } | { ok: false; reason: string };

export interface JoinRequest {
  roomId: string;
  /** Seat token from an earlier join. Reclaims that seat after a reconnect.
   * A signed-in player reclaims their own seat without one. */
  token?: string;
}

export interface MoveRequest {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

/**
 * TDD §05 game:draw_offer. With no `accept`, offers a draw (or accepts the
 * opponent's open offer). With `accept`, answers the opponent's offer.
 */
export interface DrawOfferRequest {
  accept?: boolean;
}

/** A seat this browser holds: enough to rejoin a saved game. */
export interface SeatRef {
  roomId: string;
  token: string;
}

/** One saved game in the player's "Your games" list. */
export interface GameSummary {
  roomId: string;
  color: Color;
  turn: Color;
  status: GameState['status'];
  opponentJoined: boolean;
  /** The opponent's account username, or null for a guest or an empty seat. */
  opponentName: string | null;
  moveCount: number;
  updatedAt: number;
}

export interface ClientToServerEvents {
  'room:create': (ack: (res: RoomAck) => void) => void;
  'room:join': (req: JoinRequest, ack: (res: RoomAck) => void) => void;
  /**
   * Summaries of the saved games these seats belong to. Unknown seats are skipped.
   * For a signed-in player this also lists every game their account holds a seat
   * in, and links these seats to the account.
   */
  'room:list': (seats: SeatRef[], ack: (games: GameSummary[]) => void) => void;
  'game:move': (req: MoveRequest, ack: (res: ActionAck) => void) => void;
  'game:shoo_gerald': (ack: (res: ActionAck) => void) => void;
  'game:resign': (ack: (res: ActionAck) => void) => void;
  'game:draw_offer': (req: DrawOfferRequest, ack: (res: ActionAck) => void) => void;
}

export interface ServerToClientEvents {
  'game:state': (snapshot: RoomSnapshot) => void;
}
