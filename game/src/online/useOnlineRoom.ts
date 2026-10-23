import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  fromWire,
  type ActionAck,
  type ChatMessage,
  type ClientToServerEvents,
  type Color,
  type GameSummary,
  type GameState,
  type Move,
  type OnlineDraft,
  type RoomAck,
  type RoomSnapshot,
  type SeatStatus,
  type ServerToClientEvents,
} from '@pigeon-chess/game-core';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

import { readToken } from './account';
import { forgetSeat, keepSeats, readSavedSeats, rememberSeat } from './savedGames';

/** The game this tab is showing, so a reload drops you back into it. */
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
  /** The side with an open draw offer, if any. */
  drawOffer: Color | null;
  /** Account usernames per seat; null for guests. */
  names: Record<Color, string | null> | null;
  /** This match's chat, oldest first. */
  chat: ChatMessage[];
  sendChat: (text: string) => void;
  /** The modifier draft, while it runs and after. Null for a standard game. */
  draft: OnlineDraft | null;
  draftPick: (modifierId: string) => void;
  draftFinish: () => void;
  createRoom: (withDraft: boolean) => void;
  joinRoom: (code: string) => void;
  sendMove: (move: Move) => void;
  shooGerald: () => void;
  resign: () => void;
  /** Offers a draw, or accepts the opponent's open offer. */
  offerDraw: () => void;
  answerDraw: (accept: boolean) => void;
  /** Saved games this browser or account holds a seat in, newest first. */
  savedGames: GameSummary[];
  resumeGame: (roomId: string) => void;
  forgetGame: (roomId: string) => void;
  leave: () => void;
}

/**
 * One socket per online screen. The server is the only source of game
 * state: this hook never applies a move locally, it waits for game:state.
 * A signed-in player's socket carries their session, so their games follow
 * them across devices; `account` changing reconnects with the new session.
 */
export function useOnlineRoom(account: string | null = null): OnlineRoom {
  const socketRef = useRef<GameSocket | null>(null);
  const seatRef = useRef<StoredSeat | null>(readSeat());
  const [connection, setConnection] = useState<Connection>('connecting');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [color, setColor] = useState<Color | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedGames, setSavedGames] = useState<GameSummary[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const refreshSavedGames = useCallback(() => {
    const seats = readSavedSeats();
    socketRef.current?.emit('room:list', seats, games => {
      // Drop seats for games the server deleted.
      keepSeats(games.map(game => game.roomId));
      setSavedGames([...games].sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }, []);

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
    rememberSeat(seatRef.current);
  }, []);

  useEffect(() => {
    const socket: GameSocket = io(SERVER_URL, {
      transports: ['websocket'],
      // Read on every (re)connect, so a fresh sign-in is picked up.
      auth: callback => callback(readToken() ? { token: readToken() } : {}),
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnection('online');
      refreshSavedGames();
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
    socket.on('chat:history', messages => setChat(messages));
    socket.on('chat:message', message =>
      setChat(current => (current.some(m => m.id === message.id) ? current : [...current, message])),
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [onSeat, refreshSavedGames, account]);

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
    drawOffer: snapshot?.drawOffer ?? null,
    names: snapshot?.names ?? null,
    chat,
    sendChat: text => socketRef.current?.emit('chat:send', { text }, actionAck),
    draft: snapshot?.draft ?? null,
    draftPick: modifierId => socketRef.current?.emit('draft:pick', { modifierId }, actionAck),
    draftFinish: () => socketRef.current?.emit('draft:finish', actionAck),
    // A standard room uses the old ack-only call, so it works on a server without drafts too.
    createRoom: withDraft =>
      withDraft
        ? socketRef.current?.emit('room:create', { draft: true }, onSeat)
        : socketRef.current?.emit('room:create', onSeat),
    joinRoom: code => socketRef.current?.emit('room:join', { roomId: code }, onSeat),
    sendMove: move =>
      socketRef.current?.emit(
        'game:move',
        { from: move.from, to: move.to, promotion: move.promotion },
        actionAck,
      ),
    shooGerald: () => socketRef.current?.emit('game:shoo_gerald', actionAck),
    resign: () => socketRef.current?.emit('game:resign', actionAck),
    offerDraw: () => socketRef.current?.emit('game:draw_offer', {}, actionAck),
    answerDraw: accept => socketRef.current?.emit('game:draw_offer', { accept }, actionAck),
    savedGames,
    resumeGame: id => {
      // Without a seat on this device, a signed-in player rejoins by account.
      const seat = readSavedSeats().find(saved => saved.roomId === id);
      socketRef.current?.emit('room:join', { roomId: id, token: seat?.token }, onSeat);
    },
    forgetGame: id => {
      forgetSeat(id);
      setSavedGames(games => games.filter(game => game.roomId !== id));
    },
    // Leaving only closes this view. The seat stays saved so the game can be resumed.
    leave: () => {
      seatRef.current = null;
      writeSeat(null);
      setChat([]);
    },
  };
}
