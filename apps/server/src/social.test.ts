import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  DirectMessage,
  FriendList,
  FriendStatus,
  RoomAck,
  ServerToClientEvents,
  SocialAck,
  SocialClientEvents,
  SocialServerEvents,
} from '@pigeon-chess/game-core';
import { createAccounts, placeholderEmail } from './accounts';
import { createGameServer, type GameServer } from './server';

type Social = Socket<SocialServerEvents, SocialClientEvents>;
type Game = Socket<ServerToClientEvents, ClientToServerEvents>;

const ORIGIN = 'http://localhost:5173';
let server: GameServer;
let url: string;
const sockets: Socket[] = [];

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
  for (const socket of sockets.splice(0)) socket.disconnect();
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

async function social(token?: string): Promise<Social> {
  const socket: Social = connect(`${url}/social`, { transports: ['websocket'], forceNew: true, ...(token ? { auth: { token } } : {}) });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

async function game(token: string): Promise<Game> {
  const socket: Game = connect(url, { transports: ['websocket'], forceNew: true, auth: { token } });
  sockets.push(socket);
  await new Promise<void>(resolve => socket.once('connect', () => resolve()));
  return socket;
}

const list = (s: Social) => new Promise<FriendList>(resolve => s.emit('friends:list', resolve));
const request = (s: Social, username: string) => new Promise<SocialAck>(resolve => s.emit('friends:request', { username }, resolve));
const respond = (s: Social, username: string, accept: boolean) =>
  new Promise<SocialAck>(resolve => s.emit('friends:respond', { username, accept }, resolve));
const dm = (s: Social, username: string, text: string) => new Promise<SocialAck>(resolve => s.emit('dm:send', { username, text }, resolve));
const history = (s: Social, username: string) => new Promise<DirectMessage[]>(resolve => s.emit('dm:history', { username }, resolve));
const statusOf = (s: Social, username: string, want: FriendStatus) =>
  new Promise<void>(resolve => {
    const onStatus = (update: { username: string; status: FriendStatus }) => {
      if (update.username === username && update.status === want) {
        s.off('friend:status', onStatus);
        resolve();
      }
    };
    s.on('friend:status', onStatus);
  });

async function friends(a: string, b: string) {
  const sa = await social(await register(a));
  const sb = await social(await register(b));
  await request(sa, b);
  await respond(sb, a, true);
  return { sa, sb };
}

describe('friends', () => {
  it('turns guests away', async () => {
    await expect(social()).rejects.toThrow(/Sign in/);
  });

  it('start as a request and become friends once accepted', async () => {
    const alice = await social(await register('alice'));
    const bob = await social(await register('bob'));

    expect(await request(alice, 'Bob')).toEqual({ ok: true });
    expect(await list(alice)).toEqual({ friends: [], incoming: [], outgoing: ['bob'] });
    expect(await list(bob)).toEqual({ friends: [], incoming: ['alice'], outgoing: [] });

    expect(await respond(bob, 'alice', true)).toEqual({ ok: true });
    expect((await list(alice)).friends).toEqual([{ username: 'bob', status: 'online', unread: 0 }]);
  });

  it('accept automatically when both ask, and refuse nonsense', async () => {
    const alice = await social(await register('alice'));
    const bob = await social(await register('bob'));
    await request(alice, 'bob');
    expect(await request(bob, 'alice')).toEqual({ ok: true });
    expect((await list(bob)).friends.map(f => f.username)).toEqual(['alice']);

    expect((await request(alice, 'alice')).ok).toBe(false);
    expect((await request(alice, 'nobody')).ok).toBe(false);
    expect((await request(alice, 'bob')).ok).toBe(false);
  });

  it('let friends message each other, with unread counts', async () => {
    const { sa, sb } = await friends('alice', 'bob');
    const atBob = new Promise<DirectMessage>(resolve => sb.once('dm:message', resolve));
    expect(await dm(sa, 'bob', 'fancy a game?')).toEqual({ ok: true });
    expect(await atBob).toMatchObject({ from: 'alice', to: 'bob', text: 'fancy a game?', roomId: null });

    expect((await list(sb)).friends[0].unread).toBe(1);
    expect((await history(sb, 'alice')).map(m => m.text)).toEqual(['fancy a game?']);
    expect((await list(sb)).friends[0].unread).toBe(0);
  });

  it('keep strangers from messaging', async () => {
    const alice = await social(await register('alice'));
    await register('carol');
    expect(await dm(alice, 'carol', 'hi')).toEqual({ ok: false, reason: 'You can only message friends.' });
    expect(await history(alice, 'carol')).toEqual([]);
  });

  it('show friends coming online, playing, and leaving', async () => {
    const aliceToken = await register('alice');
    const alice = await social(aliceToken);
    const bobToken = await register('bob');
    const bob = await social(bobToken);
    await request(alice, 'bob');
    await respond(bob, 'alice', true);

    const playing = statusOf(alice, 'bob', 'in-game');
    const table = await game(bobToken);
    expect((await new Promise<RoomAck>(resolve => table.emit('room:create', resolve))).ok).toBe(true);
    await playing;

    const online = statusOf(alice, 'bob', 'online');
    table.disconnect();
    await online;

    const gone = statusOf(alice, 'bob', 'offline');
    bob.disconnect();
    await gone;
  });

  it('challenge a friend into a new room', async () => {
    const aliceToken = await register('alice');
    const alice = await social(aliceToken);
    const bobToken = await register('bob');
    const bob = await social(bobToken);
    await request(alice, 'bob');
    await respond(bob, 'alice', true);

    const invite = new Promise<DirectMessage>(resolve => bob.once('dm:message', resolve));
    const res = await new Promise<{ ok: boolean; roomId?: string }>(resolve => alice.emit('friends:challenge', { username: 'bob' }, resolve));
    expect(res.ok).toBe(true);
    expect((await invite).roomId).toBe(res.roomId);

    const aliceTable = await game(aliceToken);
    const bobTable = await game(bobToken);
    expect(await new Promise<RoomAck>(r => aliceTable.emit('room:join', { roomId: res.roomId! }, r))).toMatchObject({ ok: true, color: 'white' });
    expect(await new Promise<RoomAck>(r => bobTable.emit('room:join', { roomId: res.roomId! }, r))).toMatchObject({ ok: true, color: 'black' });
  });
});
