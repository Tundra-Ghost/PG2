import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { GameSummary, SeatRef } from '@pigeon-chess/game-core';
import { readToken } from './account';
import { keepSeats, readSavedSeats } from './savedGames';
import { SERVER_URL } from './useOnlineRoom';

export type OnlineListState =
  /** Asking the server. No online rows show yet, so the list does not jump. */
  | { status: 'loading'; seats: SeatRef[] }
  /** The server answered with the games still running. */
  | { status: 'ready'; games: GameSummary[] }
  /** The server could not be reached; the saved seats show as "Online". */
  | { status: 'offline'; seats: SeatRef[] };

/** How long to wait for the server before showing the saved seats as they are. */
export const LIST_TIMEOUT_MS = 6000;

/** The few socket calls the list needs, so a test can stand in for the server. */
export interface ListSocket {
  on(event: 'connect' | 'connect_error', handler: () => void): unknown;
  emit(event: 'room:list', seats: SeatRef[], ack: (games: GameSummary[]) => void): unknown;
  disconnect(): unknown;
}

/**
 * Asks the server once which of these seats (and, signed in, which account
 * games) are still running, then hangs up. Calls `onDone` at most once, and
 * never after `cancel()`.
 */
export function askForGames(
  socket: ListSocket,
  seats: SeatRef[],
  onDone: (state: OnlineListState) => void,
  timeoutMs: number = LIST_TIMEOUT_MS,
  prune: (roomIds: string[]) => void = keepSeats,
): () => void {
  let done = false;
  const finish = (state: OnlineListState) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    socket.disconnect();
    onDone(state);
  };
  const timer = setTimeout(() => finish({ status: 'offline', seats }), timeoutMs);
  socket.on('connect_error', () => finish({ status: 'offline', seats }));
  socket.on('connect', () => {
    socket.emit('room:list', seats, games => {
      if (done) return;
      // Drop seats for games the server deleted, as the Online screen does.
      prune(games.map(game => game.roomId));
      finish({ status: 'ready', games: games.filter(game => game.status === 'active') });
    });
  });
  return () => {
    done = true;
    clearTimeout(timer);
    socket.disconnect();
  };
}

/**
 * The online games this browser or account holds a seat in, for the Ongoing
 * games list. Asks the server each time `enabled` turns on.
 */
export function useOnlineGameList(enabled: boolean, account: string | null): OnlineListState {
  // Tagged with the account it belongs to, so a sign-out never shows the last player's games.
  const [result, setResult] = useState<{ account: string | null; state: OnlineListState } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }
    const seats = readSavedSeats();
    if (seats.length === 0 && !account) {
      setResult({ account, state: { status: 'ready', games: [] } });
      return;
    }
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      auth: callback => callback(readToken() ? { token: readToken() } : {}),
    });
    return askForGames(socket as unknown as ListSocket, seats, state => setResult({ account, state }));
  }, [enabled, account]);

  if (!result || result.account !== account) return { status: 'loading', seats: [] };
  return result.state;
}
