import { describe, expect, it } from 'vitest';
import { forgetSeat, keepSeats, readSavedSeats, rememberSeat } from './savedGames';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('saved online seats', () => {
  it('remembers seats newest first without duplicates', () => {
    const store = memoryStore();
    rememberSeat({ roomId: 'AAAAA', token: 't1' }, store);
    rememberSeat({ roomId: 'BBBBB', token: 't2' }, store);
    rememberSeat({ roomId: 'AAAAA', token: 't1' }, store);
    expect(readSavedSeats(store).map(seat => seat.roomId)).toEqual(['AAAAA', 'BBBBB']);
  });

  it('forgets one seat and prunes seats the server no longer has', () => {
    const store = memoryStore();
    rememberSeat({ roomId: 'AAAAA', token: 't1' }, store);
    rememberSeat({ roomId: 'BBBBB', token: 't2' }, store);
    rememberSeat({ roomId: 'CCCCC', token: 't3' }, store);
    forgetSeat('BBBBB', store);
    keepSeats(['CCCCC'], store);
    expect(readSavedSeats(store)).toEqual([{ roomId: 'CCCCC', token: 't3' }]);
  });

  it('ignores damaged storage', () => {
    const store = memoryStore();
    store.setItem('pigeon-chess-online-games', '{oops');
    expect(readSavedSeats(store)).toEqual([]);
  });
});
