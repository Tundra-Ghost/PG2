import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  fromWire,
  type ActionAck,
  type ClientToServerEvents,
  type Color,
  type GameState,
  type Move,
  type RoomAck,
  type RoomSnapshot,
  type SeatStatus,
  type ServerToClientEvents,
} from '@pigeon-chess/game-core';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const SEAT_KEY = 'pigeon-chess-online-seat';

interface StoredSeat {
  roomId: string;
  token: string;
}

function readSeat(): StoredSeat | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as StoredSeat) : null;
  } catch {
    return null;
  }
}

function writeSeat(seat: StoredSeat | null): void {
  try {
    if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // Storage blocked: reconnect-by-token just won't survive a reload.
  }
}

export type Connection = 'connecting' | 'online' | 'offline';

export interface OnlineRoom {
  connection: Connection;
  roomId: string | null;
  color: Color | null;
  seats: Record<Color, SeatStatus> | null;
  state: GameState | null;
  error: string | null;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  sendMove: (move: Move) => void;
  shooGerald: () => void;
  leave: () => void;
}

/**
 * One socket per online screen. The server is the only source of game
 * state: this hook never applies a move locally, it waits for game:state.
 */
export function useOnlineRoom(): OnlineRoom {
  const socketRef = useRef<GameSocket | null>(null);
  const seatRef = useRef<StoredSeat | null>(readSeat());
  const [connection, setConnection] = useState<Connection>('connecting');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [color, setColor] = useState<Color | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSeat = useCallback((res: RoomAck) => {
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError(null);
    setRoomId(res.roomId);
    setColor(res.color);
    seatRef.current = { roomId: res.roomId, token: res.token };
    writeSeat(seatRef.current);
  }, []);

  useEffect(() => {
    const socket: GameSocket = io(SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnection('online');
      // Reclaim our seat after a dropped connection or a page reload.
      const seat = seatRef.current;
      if (seat) {
        socket.emit('room:join', { roomId: seat.roomId, token: seat.token }, res => {
          if (res.ok) onSeat(res);
          else {
            seatRef.current = null;
            writeSeat(null);
          }
        });
      }
    });
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', () => setConnection('offline'));
    socket.on('game:state', next => setSnapshot(next));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [onSeat]);

  const actionAck = useCallback((res: ActionAck) => {
    setError(res.ok ? null : res.reason);
  }, []);

  const state = useMemo(() => (snapshot ? fromWire(snapshot.state) : null), [snapshot]);

  return {
    connection,
    roomId,
    color,
    seats: snapshot?.seats ?? null,
    state,
    error,
    createRoom: () => socketRef.current?.emit('room:create', onSeat),
    joinRoom: code => socketRef.current?.emit('room:join', { roomId: code }, onSeat),
    sendMove: move =>
      socketRef.current?.emit(
        'game:move',
        { from: move.from, to: move.to, promotion: move.promotion },
        actionAck,
      ),
    shooGerald: () => socketRef.current?.emit('game:shoo_gerald', actionAck),
    leave: () => {
      seatRef.current = null;
      writeSeat(null);
    },
  };
}
