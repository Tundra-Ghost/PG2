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
});
