import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccounts, newRecoveryCode, placeholderEmail } from './accounts';
import { createGameServer, type GameServer } from './server';

const ORIGIN = 'http://localhost:5173';

let server: GameServer;
let url: string;

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

async function register(name: string, password = 'hunter2hunter2') {
  const res = await call('/api/auth/sign-up/email', {
    body: { email: placeholderEmail(name), password, name, username: name },
  });
  return { res, body: (await res.json()) as { token?: string } };
}

describe('accounts', () => {
  it('registers, signs in by username, and keeps a profile', async () => {
    const signedUp = await register('Gerald');
    expect(signedUp.res.status).toBe(200);
    expect(signedUp.body.token).toBeTruthy();

    const signIn = await call('/api/auth/sign-in/username', { body: { username: 'gerald', password: 'hunter2hunter2' } });
    expect(signIn.status).toBe(200);
    const { token } = (await signIn.json()) as { token: string };

    expect(await (await call('/api/profile', { token })).json()).toEqual({ profile: null });

    const profile = { displayName: 'Gerald', elo: 1234 };
    const saved = await call('/api/profile', { method: 'PUT', body: { profile }, token });
    expect(saved.status).toBe(200);
    expect(await (await call('/api/profile', { token })).json()).toEqual({ profile });

    const session = (await (await call('/api/auth/get-session', { token })).json()) as { user: { username: string } };
    expect(session.user.username).toBe('gerald');
  });

  it('turns away a wrong password and a taken username', async () => {
    await register('pidge');
    const wrong = await call('/api/auth/sign-in/username', { body: { username: 'pidge', password: 'not-the-password' } });
    expect(wrong.status).toBe(401);
    expect((await register('Pidge')).res.ok).toBe(false);
  });

  it('keeps profiles to their owner', async () => {
    const a = (await register('alpha')).body.token!;
    const b = (await register('bravo')).body.token!;
    await call('/api/profile', { method: 'PUT', body: { profile: { elo: 1500 } }, token: a });
    expect(await (await call('/api/profile', { token: b })).json()).toEqual({ profile: null });
  });

  it('rejects profile calls without a session, and bad profiles', async () => {
    expect((await call('/api/profile')).status).toBe(401);
    expect((await call('/api/profile', { token: 'made-up' })).status).toBe(401);
    const token = (await register('charlie')).body.token!;
    expect((await call('/api/profile', { method: 'PUT', body: { profile: [1, 2] }, token })).status).toBe(400);
  });

  it('signs out', async () => {
    const token = (await register('delta')).body.token!;
    expect((await call('/api/auth/sign-out', { body: {}, token })).status).toBe(200);
    expect((await call('/api/profile', { token })).status).toBe(401);
  });

  it('lets the game site send the Authorization header', async () => {
    const preflight = await fetch(url + '/api/profile', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
  });
});

describe('recovery codes', () => {
  async function codeFor(token: string) {
    const res = await call('/api/account/recovery-code', { body: {}, token });
    return ((await res.json()) as { recoveryCode: string }).recoveryCode;
  }

  const reset = (username: string, recoveryCode: string, password: string) =>
    call('/api/account/reset-password', { body: { username, recoveryCode, password } });

  const signIn = (username: string, password: string) =>
    call('/api/auth/sign-in/username', { body: { username, password } });

  it('look like XXXX-XXXX-XXXX and differ each time', () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(newRecoveryCode()).not.toBe(code);
  });

  it('reset the password once, sign out old sessions, and hand back a new code', async () => {
    const token = (await register('echo', 'old-password-1')).body.token!;
    const code = await codeFor(token);

    const res = await reset('Echo', code.toLowerCase().replace(/-/g, ''), 'new-password-1');
    expect(res.status).toBe(200);
    const next = ((await res.json()) as { recoveryCode: string }).recoveryCode;
    expect(next).not.toBe(code);

    expect((await call('/api/profile', { token })).status).toBe(401);
    expect((await signIn('echo', 'old-password-1')).status).toBe(401);
    expect((await signIn('echo', 'new-password-1')).status).toBe(200);

    expect((await reset('echo', code, 'another-password-1')).status).toBe(400);
    expect((await reset('echo', next, 'another-password-1')).status).toBe(200);
  });

  it('reject a wrong code or unknown player the same way, then slow down', async () => {
    const token = (await register('foxtrot')).body.token!;
    const code = await codeFor(token);
    const wrong = await reset('foxtrot', 'AAAA-BBBB-CCCC', 'new-password-1');
    const nobody = await reset('nobody', code, 'new-password-1');
    expect(wrong.status).toBe(400);
    expect(await nobody.json()).toEqual(await wrong.json());

    for (let i = 0; i < 4; i++) await reset('foxtrot', 'AAAA-BBBB-CCCC', 'new-password-1');
    expect((await reset('foxtrot', code, 'new-password-1')).status).toBe(429);
  });

  it('enforce the password length and need a session to issue codes', async () => {
    const token = (await register('golf')).body.token!;
    expect((await reset('golf', await codeFor(token), 'short')).status).toBe(400);
    expect((await call('/api/account/recovery-code', { body: {} })).status).toBe(401);
  });
});
