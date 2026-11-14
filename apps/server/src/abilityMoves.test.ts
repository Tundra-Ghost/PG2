import { describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';

function dashRoom() {
  const rooms = new RoomManager();
  const created = rooms.create(undefined, { draft: true });
  if (!created.ok) throw new Error(created.reason);
  rooms.join(created.roomId);
  const id = created.roomId;
  expect(rooms.draftPick(id, 'white', 'MOD-C020')).toEqual({ ok: true });
  expect(rooms.draftFinish(id, 'black')).toEqual({ ok: true });
  expect(rooms.draftFinish(id, 'white')).toEqual({ ok: true });
  return { rooms, id };
}

describe('ability moves online', () => {
  it('plays an ability the client names, such as a Gotta Go Fast dash', () => {
    const { rooms, id } = dashRoom();
    expect(rooms.move(id, 'white', { from: 'e2', to: 'e3' })).toEqual({ ok: true });
    expect(rooms.move(id, 'black', { from: 'a7', to: 'a6' })).toEqual({ ok: true });
    // Without the ability flag, e3 to e5 is not a pawn move.
    expect(rooms.move(id, 'white', { from: 'e3', to: 'e5' })).toMatchObject({ ok: false });
    expect(rooms.move(id, 'white', { from: 'e3', to: 'e5', ability: 'MOD-C020' })).toEqual({ ok: true });
    const history = rooms.snapshot(id)?.state.moveHistory ?? [];
    expect(history[history.length - 1]?.move).toMatchObject({ from: 'e3', to: 'e5', ability: 'MOD-C020' });
  });

  it('refuses an ability that is not in the match', () => {
    const { rooms, id } = dashRoom();
    expect(rooms.move(id, 'white', { from: 'e2', to: 'e4', ability: 'MOD-C003' })).toMatchObject({ ok: false });
  });
});
