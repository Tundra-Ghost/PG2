import type { Color, PieceType, Square } from '../engine/types';
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
}

export type RoomAck =
  | { ok: true; roomId: string; color: Color; token: string }
  | { ok: false; reason: string };

export type ActionAck = { ok: true } | { ok: false; reason: string };

export interface JoinRequest {
  roomId: string;
  /** Seat token from an earlier join. Reclaims that seat after a reconnect. */
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

export interface ClientToServerEvents {
  'room:create': (ack: (res: RoomAck) => void) => void;
  'room:join': (req: JoinRequest, ack: (res: RoomAck) => void) => void;
  'game:move': (req: MoveRequest, ack: (res: ActionAck) => void) => void;
  'game:shoo_gerald': (ack: (res: ActionAck) => void) => void;
  'game:resign': (ack: (res: ActionAck) => void) => void;
  'game:draw_offer': (req: DrawOfferRequest, ack: (res: ActionAck) => void) => void;
}

export interface ServerToClientEvents {
  'game:state': (snapshot: RoomSnapshot) => void;
}
