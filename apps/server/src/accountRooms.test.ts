import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameSummary,
  RoomAck,
  RoomSnapshot,
  SeatRef,
  ServerToClientEvents,
} from '@pigeon-chess/game-core';
import { createAccounts, placeholderEmail } from './accounts';
import { createGameServer, type GameServer } from './server';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ORIGIN = 'http://localhost:5173';

let server: GameServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  const accounts = await createAccounts({
    dbPath: ':memory:',
    secret: 'test-secret-that-is-at-least-32-characters-long',
    baseURL: 'http://127.0.0.1',
    trustedOrigins: [ORIGIN],
  });
  server = createGameServer({ corsOrigin: [ORIGIN], accounts });
  server.app.addHook('onClose', async () => accounts.close());
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

async function register(name: string): Promise<string> {
  const res = await fetch(`${url}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: placeholderEmail(name), password: 'hunter2hunter2', name, username: name }),
  });
  return ((await res.json()) as { token: string }).token;
}

/** A browser tab. With a token it is signed in; without, a guest. */
async function device(token?: string): Promise<Client> {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    ...(token ? { auth: { token } } : {}),
  });
  clients.push(socket);
  await new Promise<void>(resolve => socket.once('connect', () => resolve()));
  return socket;
}

const create = (c: Client) => new Promise<RoomAck>(resolve => c.emit('room:create', resolve));
const join = (c: Client, roomId: string, token?: string) =>
  new Promise<RoomAck>(resolve => c.emit('room:join', { roomId, token }, resolve));
const list = (c: Client, seats: SeatRef[] = []) =>
  new Promise<GameSummary[]>(resolve => c.emit('room:list', seats, resolve));
const stateWhere = (c: Client, check: (snapshot: RoomSnapshot) => boolean) =>
  new Promise<RoomSnapshot>(resolve => {
    const onState = (snapshot: RoomSnapshot) => {
      if (check(snapshot)) {
        c.off('game:state', onState);
        resolve(snapshot);
      }
    };
    c.on('game:state', onState);
  });

describe('online games on accounts', () => {
  it('follow the player to another device, no seat token needed', async () => {
    const alice = await register('alice');
    const laptop = await device(alice);
    const guest = await device();

    const created = await create(laptop);
    if (!created.ok) throw new Error(created.reason);
    const named = stateWhere(laptop, snapshot => snapshot.seats.black !== 'empty');
    expect((await join(guest, created.roomId)).ok).toBe(true);
    expect((await named).names).toEqual({ white: 'alice', black: null });

    const phone = await device(alice);
    const games = await list(phone);
    expect(games).toMatchObject([{ roomId: created.roomId, color: 'white', opponentJoined: true, opponentName: null }]);

    const rejoined = await join(phone, created.roomId);
    expect(rejoined).toMatchObject({ ok: true, color: 'white' });
  });

  it('show the opponent by username', async () => {
    const alice = await device(await register('alice'));
    const bob = await device(await register('bob'));
    const created = await create(alice);
    if (!created.ok) throw new Error(created.reason);
    await join(bob, created.roomId);

    expect(await list(alice)).toMatchObject([{ opponentName: 'bob' }]);
    expect(await list(bob)).toMatchObject([{ color: 'black', opponentName: 'alice' }]);
  });

  it('link seats a browser already holds once the player signs in', async () => {
    const asGuest = await device();
    const created = await create(asGuest);
    if (!created.ok) throw new Error(created.reason);
    const seat = { roomId: created.roomId, token: created.token };

    const charlie = await register('charlie');
    const signedIn = await device(charlie);
    expect(await list(signedIn, [seat])).toMatchObject([{ roomId: created.roomId }]);

    const otherDevice = await device(charlie);
    expect(await list(otherDevice)).toMatchObject([{ roomId: created.roomId, color: 'white' }]);
  });

  it("keep other players' games private and treat a bad token as a guest", async () => {
    const alice = await device(await register('alice'));
    expect((await create(alice)).ok).toBe(true);

    const mallory = await device(await register('mallory'));
    expect(await list(mallory)).toEqual([]);

    const forged = await device('not-a-real-session');
    expect(await list(forged)).toEqual([]);
    expect((await create(forged)).ok).toBe(true);
  });

  it('do not let one account take both seats', async () => {
    const alice = await register('alice');
    const laptop = await device(alice);
    const created = await create(laptop);
    if (!created.ok) throw new Error(created.reason);

    const phone = await device(alice);
    expect(await join(phone, created.roomId)).toMatchObject({ ok: true, color: 'white' });
    expect(server.rooms.snapshot(created.roomId)?.seats.black).toBe('empty');
  });
});
