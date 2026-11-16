import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, GameSummary, SeatRef, ServerToClientEvents } from '@pigeon-chess/game-core';
import { readToken } from './account';
import { keepSeats, readSavedSeats } from './savedGames';
import { SERVER_URL } from './useOnlineRoom';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type OnlineListState =
  /** Asking the server. The saved seats show as "Online" meanwhile. */
  | { status: 'loading'; seats: SeatRef[] }
  /** The server answered with the games still running. */
  | { status: 'ready'; games: GameSummary[] }
  /** The server could not be reached; the saved seats show as "Online". */
  | { status: 'offline'; seats: SeatRef[] };

/** How long to wait for the server before showing the saved seats as they are. */
const TIMEOUT_MS = 6000;

/**
 * The online games this browser or account holds a seat in, for the Ongoing
 * games list. Asks the server once when `enabled` turns on, then hangs up.
 */
export function useOnlineGameList(enabled: boolean, account: string | null): OnlineListState {
  const [state, setState] = useState<OnlineListState>(() => ({ status: 'loading', seats: readSavedSeats() }));

  useEffect(() => {
    if (!enabled) return;
    const seats = readSavedSeats();
    setState({ status: 'loading', seats });
    if (seats.length === 0 && !account) {
      setState({ status: 'ready', games: [] });
      return;
    }
    let done = false;
    const socket: GameSocket = io(SERVER_URL, {
      transports: ['websocket'],
      auth: callback => callback(readToken() ? { token: readToken() } : {}),
    });
    const giveUp = () => {
      if (done) return;
      done = true;
      setState({ status: 'offline', seats });
      socket.disconnect();
    };
    const timer = setTimeout(giveUp, TIMEOUT_MS);
    socket.on('connect_error', giveUp);
    socket.on('connect', () => {
      socket.emit('room:list', seats, games => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // Drop seats for games the server deleted, as the Online screen does.
        keepSeats(games.map(game => game.roomId));
        setState({ status: 'ready', games: games.filter(game => game.status === 'active') });
        socket.disconnect();
      });
    });
    return () => {
      done = true;
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [enabled, account]);

  return state;
}
