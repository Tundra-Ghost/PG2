import type { SeatRef } from '@pigeon-chess/game-core';

/**
 * Seats this browser holds in online games, kept in localStorage so a game
 * can be picked up again days later. The token is what proves the seat.
 */
const SAVED_KEY = 'pigeon-chess-online-games';
const MAX_SAVED = 20;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): KeyValueStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readSavedSeats(store: KeyValueStore | null = storage()): SeatRef[] {
  try {
    const raw = store?.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (seat): seat is SeatRef => typeof seat?.roomId === 'string' && typeof seat?.token === 'string',
    );
  } catch {
    return [];
  }
}

function write(seats: SeatRef[], store: KeyValueStore | null): void {
  try {
    store?.setItem(SAVED_KEY, JSON.stringify(seats));
  } catch {
    // Storage blocked: games can still be played, just not resumed later.
  }
}

/** Adds or refreshes a seat. The newest seat goes first. */
export function rememberSeat(seat: SeatRef, store: KeyValueStore | null = storage()): SeatRef[] {
  const rest = readSavedSeats(store).filter(saved => saved.roomId !== seat.roomId);
  const next = [{ roomId: seat.roomId, token: seat.token }, ...rest].slice(0, MAX_SAVED);
  write(next, store);
  return next;
}

export function forgetSeat(roomId: string, store: KeyValueStore | null = storage()): SeatRef[] {
  const next = readSavedSeats(store).filter(saved => saved.roomId !== roomId);
  write(next, store);
  return next;
}

/** Keeps only the seats the server still knows about. */
export function keepSeats(roomIds: string[], store: KeyValueStore | null = storage()): SeatRef[] {
  const next = readSavedSeats(store).filter(saved => roomIds.includes(saved.roomId));
  write(next, store);
  return next;
}
