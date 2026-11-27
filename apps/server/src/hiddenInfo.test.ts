import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  chessEngine,
  fromWire,
  getForecast,
  getHiddenPieceIds,
  getShownType,
  getVisibleSquares,
  MODIFIER_IDS,
  type ClientToServerEvents,
  type Color,
  type GameState,
  type RoomAck,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '@pigeon-chess/game-core';
import { RoomManager } from './rooms';
import { createGameServer, type GameServer } from './server';

/** White owns the hiding and disguise cards; fog covers both sides. */
function secretState(): GameState {
  const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
    { id: MODIFIER_IDS.darkAndScared, sourceColor: 'black' },
    { id: MODIFIER_IDS.invisibilityCloak, sourceColor: 'white' },
    { id: MODIFIER_IDS.sus, sourceColor: 'white' },
    { id: MODIFIER_IDS.shellGame, sourceColor: 'white' },
    { id: MODIFIER_IDS.ghosts, sourceColor: 'white' },
  ]);
  return chessEngine.beginTurn(state);
}

function setState(rooms: RoomManager, id: string, state: GameState) {
  (rooms as unknown as { rooms: Map<string, { state: GameState }> }).rooms.get(id)!.state = state;
}

/** Everything black's payload must not reveal about white. */
function expectNoWhiteSecrets(full: GameState, snapshot: RoomSnapshot) {
  const json = JSON.stringify(snapshot);
  const seen = fromWire(snapshot.state);
  const hidden = getHiddenPieceIds(full, 'black');
  const visible = getVisibleSquares(full, 'black');
  expect(hidden.size).toBeGreaterThan(0);
  expect(visible).not.toBeNull();

  // No real white id at all: every enemy id is an alias.
  for (const piece of full.pieces.values()) {
    if (piece.color === 'white') expect(json).not.toContain(piece.id);
  }
  // No hidden piece and no piece in fog.
  for (const piece of full.pieces.values()) {
    if (piece.color === 'white' && (hidden.has(piece.id) || !visible!.has(piece.square))) {
      expect(seen.pieces.get(piece.square)?.color).not.toBe('white');
    }
  }
  // No seed: it would replay every random pick.
  expect(seen.prngSeed).toBe(0);
  expect(seen.prngState).toBe(0);
  // Fog: every white piece sent stands on a square black can see.
  for (const [square, piece] of seen.pieces) {
    if (piece.color === 'white') expect(visible!.has(square)).toBe(true);
  }
  // Disguises: each white piece shows only the type black is meant to see.
  for (const [square, piece] of seen.pieces) {
    if (piece.color !== 'white') continue;
    const real = full.pieces.get(square)!;
    expect(piece.type).toBe(getShownType(full, real, 'black'));
  }
  // No card state that names the hidden or lying piece, and no decoy marks.
  const mods = seen.modifierState as Record<string, Record<string, unknown> | undefined>;
  expect(mods[MODIFIER_IDS.sus]?.white).toBeUndefined();
  expect(mods[MODIFIER_IDS.invisibilityCloak]?.white).toBeUndefined();
  expect(json).not.toContain('isGhost');
  expect(json).not.toContain('ghost-white');
  expect(seen.positionHistory).toEqual({});
  // The client still works out the same view from what it got.
  expect(getVisibleSquares(seen, 'black')).toEqual(visible);
}

describe('per-seat state', () => {
  it('sends black no hidden, fogged or disguised white pieces', () => {
    const rooms = new RoomManager();
    const created = rooms.create();
    if (!created.ok) throw new Error(created.reason);
    rooms.join(created.roomId);
    const full = secretState();
    // The cards did pick secrets for white.
    const sus = full.modifierState[MODIFIER_IDS.sus] as Partial<Record<Color, { pieceId: string }>>;
    expect(sus.white).toBeDefined();
    expect([...full.pieces.values()].some(p => p.isGhost && p.color === 'white')).toBe(true);
    setState(rooms, created.roomId, full);

    expectNoWhiteSecrets(full, rooms.snapshot(created.roomId, 'black')!);

    // White still sees all of its own pieces as they are.
    const own = fromWire(rooms.snapshot(created.roomId, 'white')!.state);
    for (const piece of full.pieces.values()) {
      if (piece.color === 'white') expect(own.pieces.get(piece.square)).toEqual(piece);
    }
    // The server keeps the full state for the rules.
    expect(fromWire(rooms.snapshot(created.roomId)!.state).pieces.size).toBe(full.pieces.size);
  });

  it('sends a blank record for an enemy move into the dark', () => {
    const rooms = new RoomManager();
    const created = rooms.create();
    if (!created.ok) throw new Error(created.reason);
    rooms.join(created.roomId);
    setState(rooms, created.roomId, chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.darkAndScared, sourceColor: 'black' },
    ])));
    expect(rooms.move(created.roomId, 'white', { from: 'g1', to: 'f3' })).toEqual({ ok: true });
    const full = fromWire(rooms.snapshot(created.roomId)!.state);
    const visible = getVisibleSquares(full, 'black')!;
    expect(visible.has('f3')).toBe(false);
    const seen = fromWire(rooms.snapshot(created.roomId, 'black')!.state);
    const record = seen.moveHistory[0];
    expect(record.hidden).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/g1|f3|knight|N/);
    expect(seen.pieces.has('f3')).toBe(false);
    // White's own record is whole.
    expect(fromWire(rooms.snapshot(created.roomId, 'white')!.state).moveHistory[0].move).toMatchObject({ from: 'g1', to: 'f3' });
  });

  it('shows everything once the game is over', () => {
    const rooms = new RoomManager();
    const created = rooms.create();
    if (!created.ok) throw new Error(created.reason);
    rooms.join(created.roomId);
    const full = secretState();
    setState(rooms, created.roomId, full);
    rooms.resign(created.roomId, 'white');
    expect(fromWire(rooms.snapshot(created.roomId, 'black')!.state).pieces.size).toBe(full.pieces.size);
  });
});

function plainRoom(state: GameState) {
  const rooms = new RoomManager();
  const created = rooms.create();
  if (!created.ok) throw new Error(created.reason);
  rooms.join(created.roomId);
  setState(rooms, created.roomId, state);
  return { rooms, id: created.roomId };
}

describe('per-seat state details', () => {
  it('hides ability timers without Tells, unused vents and decoy ids', () => {
    const state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.ghosts, sourceColor: 'white' },
    ]));
    const knight = state.pieces.get('g1')!;
    state.pieces.set('g1', { ...knight, cooldowns: { 'MOD-C020': 2 }, abilityCooldowns: { 'MOD-C020': 2 } });
    state.tiles.set('d4', { square: 'd4', effects: [], isVent: true });
    const { rooms, id } = plainRoom(state);
    const json = JSON.stringify(rooms.snapshot(id, 'black'));
    const seen = fromWire(rooms.snapshot(id, 'black')!.state);
    expect(seen.pieces.get('g1')).toMatchObject({ type: 'knight', cooldowns: {} });
    expect(seen.pieces.get('g1')!.abilityCooldowns).toBeUndefined();
    expect(seen.tiles.get('d4')?.isVent).toBeUndefined();
    expect(json).not.toContain('ghost-');
    expect(json).not.toContain('isGhost');
    // Ghosts look like any other piece: same fields, uuid-shaped id.
    const ghosts = [...state.pieces.values()].filter(p => p.isGhost);
    expect(ghosts.length).toBeGreaterThan(0);
    for (const ghost of ghosts) {
      const shown = seen.pieces.get(ghost.square)!;
      expect(Object.keys(shown).sort()).toEqual(Object.keys(seen.pieces.get('a2')!).sort());
      expect(shown.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    // The server still has everything.
    expect(rooms.snapshot(id)!.state.pieces.find(([sq]) => sq === 'g1')![1].abilityCooldowns).toEqual({ 'MOD-C020': 2 });
  });

  it('blanks events in fog and keeps them blank, and hides clock and castling changes', () => {
    const state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.darkAndScared, sourceColor: 'black' },
    ]));
    state.eventHistory.push({ id: 'ev-1', ply: 0, type: 'modifier', modifierId: MODIFIER_IDS.darkAndScared, title: 'Test', message: 'Secret thing on e2.', squares: ['e2'] });
    state.flags.halfMoveClock = 7;
    state.flags.castlingRights.white = { kingSide: false, queenSide: false };
    const { rooms, id } = plainRoom(state);
    const seen = fromWire(rooms.snapshot(id, 'black')!.state);
    expect(seen.eventHistory[0].message).not.toContain('e2');
    expect(seen.eventHistory[0].squares).toBeUndefined();
    expect(seen.flags.halfMoveClock).toBe(0);
    expect(seen.flags.castlingRights.white).toEqual({ kingSide: true, queenSide: true });
    expect(fromWire(rooms.snapshot(id, 'white')!.state).eventHistory[0].message).toContain('e2');
  });

  it('sends Shell Game cups only where the viewer can see them, with matching ids', () => {
    const state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.shellGame, sourceColor: 'white' },
    ]));
    const { rooms, id } = plainRoom(state);
    const seen = fromWire(rooms.snapshot(id, 'black')!.state);
    const cups = (seen.modifierState[MODIFIER_IDS.shellGame] as Record<string, Array<{ pieceId: string; square: string }>>).white;
    expect(cups.length).toBe(3);
    for (const cup of cups) {
      const piece = seen.pieces.get(cup.square as never)!;
      expect(piece.id).toBe(cup.pieceId);
      expect(piece.type).toBe('pawn');
    }
  });
});

describe('Crystal Ball online', () => {
  it('sends the owner the forecast worked out on the full state', () => {
    let state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.crystalBall, sourceColor: 'white' },
      { id: MODIFIER_IDS.theBirds, sourceColor: 'black' },
    ]));
    const { rooms, id } = plainRoom(state);
    state = fromWire(rooms.snapshot(id)!.state);
    const expected = getForecast(state, 'white');
    const seen = fromWire(rooms.snapshot(id, 'white')!.state);
    expect(seen.prngState).toBe(0);
    expect(getForecast(seen, 'white')).toEqual(expected);
    expect(fromWire(rooms.snapshot(id, 'black')!.state).modifierState[MODIFIER_IDS.crystalBall]).toBeUndefined();
  });
});

describe('per-seat state over sockets', () => {
  let server: GameServer;
  let url: string;
  const clients: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];

  beforeEach(async () => {
    server = createGameServer();
    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const address = server.app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const c of clients.splice(0)) c.disconnect();
    server.io.close();
    await server.app.close();
  });

  const client = () => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = connect(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    return socket;
  };
  /** The broadcast after the draw offer, skipping ones still in flight from the join. */
  const offerState = (c: Socket<ServerToClientEvents, ClientToServerEvents>) =>
    new Promise<RoomSnapshot>(resolve => {
      const onState = (snapshot: RoomSnapshot) => {
        if (snapshot.drawOffer !== 'white') return;
        c.off('game:state', onState);
        resolve(snapshot);
      };
      c.on('game:state', onState);
    });

  it('gives each seat its own redacted payload', async () => {
    const white = client();
    const black = client();
    const created = await new Promise<RoomAck>(resolve => white.emit('room:create', resolve));
    if (!created.ok) throw new Error(created.reason);
    const joined = await new Promise<RoomAck>(resolve => black.emit('room:join', { roomId: created.roomId }, resolve));
    if (!joined.ok) throw new Error(joined.reason);

    const full = secretState();
    setState(server.rooms, created.roomId, full);
    const toBlack = offerState(black);
    const toWhite = offerState(white);
    // Any action that broadcasts will do: a draw offer.
    await new Promise(resolve => white.emit('game:draw_offer', {}, resolve));
    const [blackView, whiteView] = await Promise.all([toBlack, toWhite]);

    expectNoWhiteSecrets(full, blackView);
    // White's payload holds every white piece, but no hidden black detail it may not see.
    const whiteSeen = fromWire(whiteView.state);
    for (const piece of full.pieces.values()) {
      if (piece.color === 'white') expect(whiteSeen.pieces.get(piece.square)?.id).toBe(piece.id);
    }
    expect(JSON.stringify(whiteView)).not.toContain('ghost-black');
  });
});
