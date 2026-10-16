import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROOM_EXPIRY_MS, RoomManager } from './rooms';
import { FileStore } from './store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pg2-rooms-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function startedRoom(rooms: RoomManager) {
  const created = rooms.create();
  if (!created.ok) throw new Error(created.reason);
  const joined = rooms.join(created.roomId);
  if (!joined.ok) throw new Error(joined.reason);
  return { roomId: created.roomId, whiteToken: created.token, blackToken: joined.token };
}

describe('saved rooms', () => {
  it('a game survives a server restart and both players can reclaim their seats', () => {
    const before = new RoomManager(new FileStore(dir));
    const { roomId, whiteToken, blackToken } = startedRoom(before);
    expect(before.move(roomId, 'white', { from: 'e2', to: 'e4' })).toEqual({ ok: true });

    const after = new RoomManager(new FileStore(dir));
    const snapshot = after.snapshot(roomId);
    expect(snapshot?.seats).toEqual({ white: 'disconnected', black: 'disconnected' });
    expect(snapshot?.state.turn).toBe('black');

    expect(after.join(roomId, blackToken)).toMatchObject({ ok: true, color: 'black' });
    expect(after.join(roomId, whiteToken)).toMatchObject({ ok: true, color: 'white' });
    expect(after.move(roomId, 'black', { from: 'e7', to: 'e5' })).toEqual({ ok: true });
  });

  it('a started game is kept when both players leave', () => {
    const rooms = new RoomManager(new FileStore(dir));
    const { roomId } = startedRoom(rooms);
    rooms.setConnected(roomId, 'white', false);
    rooms.setConnected(roomId, 'black', false);
    rooms.closeIfEmpty(roomId);
    expect(rooms.snapshot(roomId)).not.toBeNull();
  });

  it('a room nobody joined is dropped when its creator leaves', () => {
    const rooms = new RoomManager(new FileStore(dir));
    const created = rooms.create();
    if (!created.ok) throw new Error(created.reason);
    rooms.setConnected(created.roomId, 'white', false);
    rooms.closeIfEmpty(created.roomId);
    expect(rooms.snapshot(created.roomId)).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rooms idle past the expiry are deleted on start', () => {
    let now = 1_000_000;
    const rooms = new RoomManager(new FileStore(dir), () => now);
    const { roomId } = startedRoom(rooms);

    now += ROOM_EXPIRY_MS + 1;
    const later = new RoomManager(new FileStore(dir), () => now);
    expect(later.snapshot(roomId)).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  });

  it('a damaged save file is skipped, not fatal', () => {
    writeFileSync(join(dir, 'BROKE.json'), '{not json');
    const rooms = new RoomManager(new FileStore(dir));
    const { roomId } = startedRoom(rooms);
    expect(new RoomManager(new FileStore(dir)).snapshot(roomId)).not.toBeNull();
  });

  it('lists saved games only for seats with the right token', () => {
    const rooms = new RoomManager(new FileStore(dir));
    const { roomId, whiteToken } = startedRoom(rooms);
    expect(rooms.summaries([{ roomId, token: whiteToken }])).toMatchObject([
      { roomId, color: 'white', turn: 'white', status: 'active', opponentJoined: true, moveCount: 0 },
    ]);
    expect(rooms.summaries([{ roomId, token: 'wrong' }])).toEqual([]);
    expect(rooms.summaries([{ roomId: 'NOPE1', token: whiteToken }])).toEqual([]);
  });
});
