import { describe, expect, it } from 'vitest';
import { fromWire } from '@pigeon-chess/game-core';
import { RoomManager } from './rooms';

function undoRoom() {
  const rooms = new RoomManager();
  const created = rooms.create(undefined, { draft: true });
  if (!created.ok) throw new Error(created.reason);
  rooms.join(created.roomId);
  const id = created.roomId;
  expect(rooms.draftPick(id, 'white', 'MOD-C015')).toEqual({ ok: true });
  expect(rooms.draftFinish(id, 'black')).toEqual({ ok: true });
  expect(rooms.draftFinish(id, 'white')).toEqual({ ok: true });
  return { rooms, id };
}

describe('Ctrl+Z online (MOD-C015)', () => {
  it('refuses before a round, on the wrong turn, and twice; undoes once', () => {
    const { rooms, id } = undoRoom();
    expect(rooms.undo(id, 'white')).toMatchObject({ ok: false });
    expect(rooms.move(id, 'white', { from: 'e2', to: 'e4' })).toEqual({ ok: true });
    expect(rooms.undo(id, 'black')).toMatchObject({ ok: false });
    expect(rooms.move(id, 'black', { from: 'e7', to: 'e5' })).toEqual({ ok: true });
    expect(rooms.undo(id, 'white')).toEqual({ ok: true });
    const state = fromWire(rooms.snapshot(id)!.state);
    expect(state.moveHistory).toHaveLength(0);
    expect(state.pieces.get('e2')).toMatchObject({ type: 'pawn' });
    expect(rooms.undo(id, 'white')).toMatchObject({ ok: false });
    // The players never receive the saved game.
    expect(JSON.stringify(rooms.snapshot(id, 'black')!.state.modifierState)).not.toContain('pieces');
  });
});
