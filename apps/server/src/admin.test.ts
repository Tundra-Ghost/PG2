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
});
