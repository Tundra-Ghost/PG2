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

export interface ClientToServerEvents {
  'room:create': (ack: (res: RoomAck) => void) => void;
  'room:join': (req: JoinRequest, ack: (res: RoomAck) => void) => void;
  'game:move': (req: MoveRequest, ack: (res: ActionAck) => void) => void;
  'game:shoo_gerald': (ack: (res: ActionAck) => void) => void;
}

export interface ServerToClientEvents {
  'game:state': (snapshot: RoomSnapshot) => void;
}
