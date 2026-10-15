import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  fromWire,
  type ActionAck,
  type ClientToServerEvents,
  type MoveRequest,
  type RoomAck,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '@pigeon-chess/game-core';
import { createGameServer, type GameServer } from './server';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: GameServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  server = createGameServer();
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  server.io.close();
  await server.app.close();
});

function client(): Client {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return socket;
}

const create = (c: Client) => new Promise<RoomAck>(resolve => c.emit('room:create', resolve));
const join = (c: Client, roomId: string, token?: string) =>
  new Promise<RoomAck>(resolve => c.emit('room:join', { roomId, token }, resolve));
const move = (c: Client, req: MoveRequest) =>
  new Promise<ActionAck>(resolve => c.emit('game:move', req, resolve));
const resign = (c: Client) => new Promise<ActionAck>(resolve => c.emit('game:resign', resolve));
const drawOffer = (c: Client, accept?: boolean) =>
  new Promise<ActionAck>(resolve => c.emit('game:draw_offer', { accept }, resolve));
/** Waits for a broadcast that passes the check, skipping earlier ones still in flight. */
const stateWhere = (c: Client, check: (snapshot: RoomSnapshot) => boolean) =>
  new Promise<RoomSnapshot>(resolve => {
    const onState = (snapshot: RoomSnapshot) => {
      if (!check(snapshot)) return;
      c.off('game:state', onState);
      resolve(snapshot);
    };
    c.on('game:state', onState);
  });
const nextState = (c: Client) => new Promise<RoomSnapshot>(resolve => c.once('game:state', resolve));

async function startGame() {
  const white = client();
  const black = client();
  const created = await create(white);
  if (!created.ok) throw new Error(created.reason);
  const joined = await join(black, created.roomId);
  if (!joined.ok) throw new Error(joined.reason);
  return { white, black, roomId: created.roomId, blackToken: joined.token };
}

describe('game server', () => {
  it('pairs two players and broadcasts server-validated moves to both', async () => {
    const { white, black } = await startGame();

    const seenByBlack = nextState(black);
    expect(await move(white, { from: 'e2', to: 'e4' })).toEqual({ ok: true });
    const snapshot = await seenByBlack;

    const state = fromWire(snapshot.state);
    expect(state.pieces.get('e4')?.color).toBe('white');
    expect(state.turn).toBe('black');
    expect(snapshot.seats).toEqual({ white: 'connected', black: 'connected' });
  });

  it('rejects moves out of turn, illegal moves, and moving the other side', async () => {
    const { white, black } = await startGame();

    expect(await move(black, { from: 'e7', to: 'e5' })).toMatchObject({ ok: false });
    expect(await move(white, { from: 'e2', to: 'e5' })).toMatchObject({ ok: false });
    // White tries to move a black pawn on its own turn: the seat sets the colour.
    expect(await move(white, { from: 'e7', to: 'e5' })).toMatchObject({ ok: false });
  });

  it('refuses moves until an opponent joins, and refuses a third player', async () => {
    const white = client();
    const created = await create(white);
    if (!created.ok) throw new Error(created.reason);
    expect(await move(white, { from: 'e2', to: 'e4' })).toMatchObject({ ok: false });

    await join(client(), created.roomId);
    expect(await join(client(), created.roomId)).toMatchObject({ ok: false, reason: 'That room is full.' });
  });

  it('lets a player reclaim their seat with the token after a reconnect', async () => {
    const { white, black, roomId, blackToken } = await startGame();
    await move(white, { from: 'e2', to: 'e4' });

    const whiteSeesDrop = nextState(white);
    black.disconnect();
    expect((await whiteSeesDrop).seats.black).toBe('disconnected');

    const again = client();
    const rejoined = await join(again, roomId, blackToken);
    expect(rejoined).toMatchObject({ ok: true, color: 'black' });
    expect(await move(again, { from: 'e7', to: 'e5' })).toEqual({ ok: true });
  });

  it('survives a client that sends no callback or a bad payload', async () => {
    const { white } = await startGame();
    white.emit('game:move', null as unknown as MoveRequest, undefined as unknown as (res: ActionAck) => void);
    expect(await move(white, { from: 'e2', to: 'e4' })).toEqual({ ok: true });
  });

  it('resigning ends the game for both players and blocks further moves', async () => {
    const { white, black } = await startGame();

    const seenByWhite = stateWhere(white, s => s.state.status !== 'active');
    expect(await resign(black)).toEqual({ ok: true });
    const state = fromWire((await seenByWhite).state);
    expect(state.status).toBe('resigned');
    expect(state.resignedBy).toBe('black');

    expect(await move(white, { from: 'e2', to: 'e4' })).toMatchObject({ ok: false });
    expect(await resign(white)).toMatchObject({ ok: false });
  });

  it('runs the draw offer flow: offer, decline, offer again, accept', async () => {
    const { white, black } = await startGame();

    let seen = stateWhere(black, s => s.drawOffer !== null);
    expect(await drawOffer(white)).toEqual({ ok: true });
    expect((await seen).drawOffer).toBe('white');

    // You cannot accept or decline your own offer.
    expect(await drawOffer(white, true)).toMatchObject({ ok: false });

    seen = stateWhere(white, s => s.drawOffer === null);
    expect(await drawOffer(black, false)).toEqual({ ok: true });
    expect((await seen).drawOffer).toBeNull();

    expect(await drawOffer(white)).toEqual({ ok: true });
    seen = stateWhere(white, s => s.state.status !== 'active');
    expect(await drawOffer(black, true)).toEqual({ ok: true });
    const snapshot = await seen;
    const state = fromWire(snapshot.state);
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('agreement');
    expect(snapshot.drawOffer).toBeNull();
  });

  it('a move withdraws an open draw offer', async () => {
    const { white, black } = await startGame();

    expect(await drawOffer(white)).toEqual({ ok: true });
    const seen = stateWhere(black, s => s.state.moveHistory.length > 0);
    expect(await move(white, { from: 'e2', to: 'e4' })).toEqual({ ok: true });
    expect((await seen).drawOffer).toBeNull();
    expect(await drawOffer(black, true)).toMatchObject({ ok: false });
  });
});
