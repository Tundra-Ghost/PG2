import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSummary, SeatRef } from '@pigeon-chess/game-core';
import { askForGames, type ListSocket, type OnlineListState } from './useOnlineGameList';

/** A stand-in server: the test fires connect, connect_error or the list reply by hand. */
function fakeSocket() {
  const handlers: Record<string, () => void> = {};
  let reply: ((games: GameSummary[]) => void) | null = null;
  const socket: ListSocket & { disconnected: boolean } = {
    disconnected: false,
    on: (event, handler) => void (handlers[event] = handler),
    emit: (_event, _seats, ack) => void (reply = ack),
    disconnect: () => void (socket.disconnected = true),
  };
  return {
    socket,
    connect: () => handlers.connect?.(),
    fail: () => handlers.connect_error?.(),
    answer: (games: GameSummary[]) => reply?.(games),
  };
}

const seats: SeatRef[] = [{ roomId: 'AAAAA', token: 't1' }, { roomId: 'BBBBB', token: 't2' }];
const game = (roomId: string, status: GameSummary['status']): GameSummary => ({
  roomId, color: 'white', turn: 'white', status, opponentJoined: true, opponentName: null, moveCount: 2, updatedAt: 1,
});

describe('asking the server for online games', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('keeps running games, prunes deleted seats and hangs up', () => {
    const fake = fakeSocket();
    const results: OnlineListState[] = [];
    const prune = vi.fn();
    askForGames(fake.socket, seats, state => results.push(state), 6000, prune);
    fake.connect();
    fake.answer([game('AAAAA', 'active'), game('CCCCC', 'checkmate')]);
    expect(prune).toHaveBeenCalledWith(['AAAAA', 'CCCCC']);
    expect(results).toEqual([{ status: 'ready', games: [game('AAAAA', 'active')] }]);
    expect(fake.socket.disconnected).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(results).toHaveLength(1);
  });

  it('falls back to the saved seats when the server is out of reach or slow', () => {
    const failed = fakeSocket();
    const results: OnlineListState[] = [];
    askForGames(failed.socket, seats, state => results.push(state));
    failed.fail();
    expect(results).toEqual([{ status: 'offline', seats }]);

    const slow = fakeSocket();
    const late: OnlineListState[] = [];
    askForGames(slow.socket, seats, state => late.push(state), 6000, () => {});
    slow.connect();
    vi.advanceTimersByTime(6000);
    slow.answer([game('AAAAA', 'active')]);
    expect(late).toEqual([{ status: 'offline', seats }]);
  });

  it('reports nothing once cancelled', () => {
    const fake = fakeSocket();
    const results: OnlineListState[] = [];
    const cancel = askForGames(fake.socket, seats, state => results.push(state), 6000, () => {});
    fake.connect();
    cancel();
    fake.answer([game('AAAAA', 'active')]);
    vi.advanceTimersByTime(10_000);
    expect(results).toEqual([]);
    expect(fake.socket.disconnected).toBe(true);
  });
});
