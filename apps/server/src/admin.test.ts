import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccounts, placeholderEmail } from './accounts';
import { parseAdminIds } from './admin';
import { createGameServer, type GameServer } from './server';

const ORIGIN = 'http://localhost:5173';
const BUILD = { version: '0.2026.11.27.1', commit: 'abc1234', builtAt: '2026-11-27T00:00:00.000Z' };

/** Every admin endpoint. Each must turn away guests and players with a 403. */
export const ADMIN_ENDPOINTS: { method: 'GET' | 'POST'; path: string; body?: unknown }[] = [
  { method: 'GET', path: '/api/admin/check' },
  { method: 'GET', path: '/api/admin/overview' },
  { method: 'GET', path: '/api/admin/stats' },
  { method: 'GET', path: '/api/admin/surveys' },
  { method: 'GET', path: '/api/admin/accounts?q=a' },
  { method: 'GET', path: '/api/admin/accounts/someid' },
  { method: 'POST', path: '/api/admin/accounts/someid/ban', body: { reason: 'x' } },
  { method: 'POST', path: '/api/admin/accounts/someid/unban', body: { reason: 'x' } },
  { method: 'POST', path: '/api/admin/accounts/someid/rename', body: { displayName: 'x' } },
  { method: 'GET', path: '/api/admin/rooms' },
  { method: 'POST', path: '/api/admin/rooms/ABCDEF/end', body: { reason: 'x' } },
  { method: 'GET', path: '/api/admin/audit' },
  { method: 'GET', path: '/api/admin/no-such-page' },
];

let server: GameServer;
let url: string;
const adminIds = new Set<string>();

beforeEach(async () => {
  adminIds.clear();
  const accounts = await createAccounts({
    dbPath: ':memory:',
    secret: 'test-secret-that-is-at-least-32-characters-long',
    baseURL: 'http://127.0.0.1',
    trustedOrigins: [ORIGIN],
  });
  server = createGameServer({ corsOrigin: [ORIGIN], accounts, adminIds, build: BUILD });
  server.app.addHook('onClose', async () => accounts.close());
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server.io.close();
  await server.app.close();
});

function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  return fetch(url + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Origin: ORIGIN,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

async function register(name: string) {
  const res = await call('/api/auth/sign-up/email', {
    body: { email: placeholderEmail(name), password: 'hunter2hunter2', name, username: name },
  });
  const body = (await res.json()) as { token: string; user: { id: string } };
  return { token: body.token, id: body.user.id };
}

describe('admin access', () => {
  it('reads admin ids from a comma separated setting', () => {
    expect([...parseAdminIds(' a1, b2 ,,')]).toEqual(['a1', 'b2']);
    expect(parseAdminIds(undefined).size).toBe(0);
  });

  it('turns away guests, players and bad tokens with a bare 403 on every endpoint', async () => {
    const player = await register('plainplayer');
    const owner = await register('theowner');
    adminIds.add(owner.id);
    for (const endpoint of ADMIN_ENDPOINTS) {
      for (const token of [undefined, player.token, 'not-a-real-token']) {
        const res = await call(endpoint.path, { method: endpoint.method, body: endpoint.body ?? (endpoint.method === 'POST' ? {} : undefined), token });
        expect(res.status, `${endpoint.method} ${endpoint.path}`).toBe(403);
        expect(await res.json()).toEqual({ error: 'Forbidden' });
      }
    }
  });

  it('lets nobody in when no admin ids are set', async () => {
    const owner = await register('theowner');
    expect((await call('/api/admin/check', { token: owner.token })).status).toBe(403);
  });

  it('lets an admin account in and reports the server version', async () => {
    const owner = await register('theowner');
    adminIds.add(owner.id);
    expect((await call('/api/admin/check', { token: owner.token })).status).toBe(200);
    expect(await (await call('/api/admin/overview', { token: owner.token })).json()).toMatchObject({ server: BUILD });
  });

  it('lists surveys for the admin, newest first, filtered', async () => {
    const owner = await register('theowner');
    adminIds.add(owner.id);
    const send = (fun: number, context: Record<string, unknown>) =>
      call('/api/survey', { body: { survey: 'post-game-v1', answers: [{ id: 'fun', kind: 'scale', question: 'Fun?', answer: fun }], context } });
    await send(4, { version: '0.2026.11.27.1', modifiers: ['VENT_TILES'] });
    await send(2, { version: '0.2026.11.27.2', modifiers: [{}, 7] });
    await call('/api/survey', { body: { survey: 'post-game-v1', answers: [{ id: 'fun', kind: 'text', question: 'Fun?', answer: 'meh' }], context: { version: 3 } } });
    const all = (await (await call('/api/admin/surveys', { token: owner.token })).json()) as {
      responses: { answers: { answer: number | string }[]; userId?: string }[];
      totals: { average: number }[];
      versions: string[];
      modifiers: string[];
    };
    expect(all.responses.map(r => r.answers[0].answer)).toEqual(['meh', 2, 4]);
    expect(all.responses[1]).toMatchObject({ context: { modifiers: [] } });
    expect(all.responses[0]).toMatchObject({ context: { version: 'unknown' } });
    expect(all.responses[0]).not.toHaveProperty('userId');
    expect(all.totals.find(t => t.average !== undefined)!.average).toBe(3);
    expect(all.versions).toEqual(['unknown', '0.2026.11.27.2', '0.2026.11.27.1']);
    expect(all.modifiers).toEqual(['VENT_TILES']);
    const vent = (await (await call('/api/admin/surveys?modifier=VENT_TILES&from=2000-01-01&to=bad', { token: owner.token })).json()) as { responses: unknown[] };
    expect(vent.responses).toHaveLength(1);
  });

  it('shows the admin account and visitor stats', async () => {
    const owner = await register('theowner');
    await register('someone');
    adminIds.add(owner.id);
    expect((await call('/api/usage', { body: { kind: 'visit', device: 'phone' } })).status).toBe(200);
    expect((await call('/api/usage', { body: { kind: 'online_start' } })).status).toBe(400);
    const stats = (await (await call('/api/admin/stats', { token: owner.token })).json()) as {
      accounts: { total: number; active1: number; newPerDay: { count: number }[] };
      daily: { pageLoads: number; phone: number }[];
    };
    expect(stats.accounts.total).toBe(2);
    expect(stats.accounts.active1).toBe(2);
    expect(stats.accounts.newPerDay.at(-1)!.count).toBe(2);
    expect(stats.daily.at(-1)).toMatchObject({ pageLoads: 1, phone: 1 });
  });

  it('finds, bans, unbans and renames an account, and logs every action', async () => {
    const owner = await register('theowner');
    const rude = await register('rudebird');
    adminIds.add(owner.id);
    const admin = (path: string, body?: unknown) => call(`/api/admin${path}`, { token: owner.token, body });

    const found = (await (await admin('/accounts?q=RUDE')).json()) as { accounts: { id: string; username: string; banned: unknown }[] };
    expect(found.accounts).toEqual([expect.objectContaining({ id: rude.id, username: 'rudebird', banned: null })]);
    expect((await (await admin('/accounts?q=%25')).json()) as { accounts: unknown[] }).toEqual({ accounts: [] });

    expect((await admin(`/accounts/${rude.id}/ban`, { reason: '  ' })).status).toBe(400);
    expect((await admin(`/accounts/${owner.id}/ban`, { reason: 'oops' })).status).toBe(400);
    expect((await admin(`/accounts/${rude.id}/ban`, { reason: 'spam in chat' })).status).toBe(200);
    // Signed out everywhere, and can't sign back in.
    expect((await call('/api/profile', { token: rude.token })).status).toBe(401);
    const signIn = await call('/api/auth/sign-in/username', { body: { username: 'rudebird', password: 'hunter2hunter2' } });
    expect(signIn.ok).toBe(false);
    const detail = (await (await admin(`/accounts/${rude.id}`)).json()) as { account: { banned: { reason: string } } };
    expect(detail.account.banned.reason).toBe('spam in chat');

    expect((await admin(`/accounts/${rude.id}/unban`, { reason: 'appeal' })).status).toBe(200);
    const again = await call('/api/auth/sign-in/username', { body: { username: 'rudebird', password: 'hunter2hunter2' } });
    expect(again.status).toBe(200);
    const token = ((await again.json()) as { token: string }).token;
    await call('/api/profile', { method: 'PUT', token, body: { profile: { displayName: 'Bad Word', elo: 900 } } });

    expect((await admin(`/accounts/${rude.id}/rename`, { displayName: 'x'.repeat(31) })).status).toBe(400);
    expect((await admin(`/accounts/${rude.id}/rename`, { displayName: 'Polite Pigeon' })).status).toBe(200);
    expect((await call('/api/profile', { token })).status).toBe(401);
    const renamed = (await (await admin(`/accounts/${rude.id}`)).json()) as { account: { displayName: string } };
    expect(renamed.account.displayName).toBe('Polite Pigeon');

    expect((await admin('/rooms/NOPE00/end', { reason: 'stuck' })).status).toBe(404);
    const audit = (await (await admin('/audit')).json()) as { entries: { admin: string; action: string; target: string; detail: string }[] };
    expect(audit.entries.map(e => [e.admin, e.action, e.target, e.detail])).toEqual([
      ['theowner', 'rename', 'rudebird', 'Bad Word -> Polite Pigeon'],
      ['theowner', 'unban', 'rudebird', 'appeal'],
      ['theowner', 'ban', 'rudebird', 'spam in chat'],
    ]);
  });

  it('ends a stuck online room', async () => {
    const owner = await register('theowner');
    adminIds.add(owner.id);
    const room = server.rooms.create();
    if (!room.ok) throw new Error('no room');
    const rooms = (await (await call('/api/admin/rooms', { token: owner.token })).json()) as { rooms: { id: string; whiteId?: string }[] };
    expect(rooms.rooms.map(r => r.id)).toEqual([room.roomId]);
    expect(rooms.rooms[0]).not.toHaveProperty('whiteId');
    expect((await call(`/api/admin/rooms/${room.roomId}/end`, { token: owner.token, body: { reason: 'stuck' } })).status).toBe(200);
    expect(server.rooms.snapshot(room.roomId)).toBeNull();
  });
});
