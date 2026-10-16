import { SERVER_URL } from './useOnlineRoom';

/**
 * Player accounts on the game server. Sessions are bearer tokens kept in
 * localStorage: the site and the server are on different domains, and
 * browsers block cookies between them.
 */
const TOKEN_KEY = 'pigeon-chess-session';

export interface Account {
  username: string;
}

export type AccountResult = { ok: true; account: Account } | { ok: false; reason: string };

/** Better Auth requires an email; players only ever pick a username. */
function placeholderEmail(username: string): string {
  return `${username.toLowerCase()}@players.pigeon-chess.invalid`;
}

/** The signed-in session token, or null for a guest. */
export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  const token = readToken();
  return fetch(`${SERVER_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Better Auth error codes, in player words. */
const REASONS: Record<string, string> = {
  USERNAME_IS_ALREADY_TAKEN: 'That username is taken.',
  USER_ALREADY_EXISTS: 'That username is taken.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'That username is taken.',
  INVALID_USERNAME_OR_PASSWORD: 'Wrong username or password.',
  USERNAME_TOO_SHORT: 'Usernames need at least 3 characters.',
  USERNAME_TOO_LONG: 'Usernames can be at most 30 characters.',
  INVALID_USERNAME: 'Usernames can use letters, numbers, _ and . only.',
  PASSWORD_TOO_SHORT: 'Passwords need at least 8 characters.',
  PASSWORD_TOO_LONG: 'That password is too long.',
};

async function failure(res: Response): Promise<{ ok: false; reason: string }> {
  if (res.status === 429) return { ok: false, reason: 'Too many tries. Wait a minute and try again.' };
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  return { ok: false, reason: (body?.code && REASONS[body.code]) || body?.message || 'Something went wrong.' };
}

async function signedIn(res: Response): Promise<AccountResult> {
  if (!res.ok) return failure(res);
  const body = (await res.json()) as { token?: string; user?: { username?: string } };
  if (!body.token || !body.user?.username) return { ok: false, reason: 'Something went wrong.' };
  writeToken(body.token);
  return { ok: true, account: { username: body.user.username } };
}

const unreachable = { ok: false, reason: 'Could not reach the game server. Try again in a moment.' } as const;

export async function register(username: string, password: string): Promise<AccountResult> {
  try {
    const name = username.trim();
    return await signedIn(
      await call('/api/auth/sign-up/email', {
        body: { email: placeholderEmail(name), password, name, username: name },
      }),
    );
  } catch {
    return unreachable;
  }
}

export async function signIn(username: string, password: string): Promise<AccountResult> {
  try {
    return await signedIn(await call('/api/auth/sign-in/username', { body: { username: username.trim(), password } }));
  } catch {
    return unreachable;
  }
}

export async function signOut(): Promise<void> {
  try {
    await call('/api/auth/sign-out', { body: {} });
  } catch {
    // Forgetting the token below signs this browser out either way.
  }
  writeToken(null);
}

/** The signed-in account, or null. A dead session is forgotten. */
export async function currentAccount(): Promise<Account | null> {
  if (!readToken()) return null;
  const res = await call('/api/auth/get-session');
  if (!res.ok) return null;
  const body = (await res.json()) as { user?: { username?: string } } | null;
  if (!body?.user?.username) {
    writeToken(null);
    return null;
  }
  return { username: body.user.username };
}

/** The profile saved on the account, or null when it has none yet. */
export async function fetchProfile(): Promise<unknown> {
  const res = await call('/api/profile');
  if (!res.ok) throw new Error(`profile fetch failed: ${res.status}`);
  return ((await res.json()) as { profile: unknown }).profile;
}

export async function uploadProfile(profile: unknown): Promise<void> {
  const res = await call('/api/profile', { method: 'PUT', body: { profile } });
  if (!res.ok) throw new Error(`profile upload failed: ${res.status}`);
}

/** A new recovery code for the signed-in player. Replaces the old one. */
export async function requestRecoveryCode(): Promise<string | null> {
  try {
    const res = await call('/api/account/recovery-code', { body: {} });
    if (!res.ok) return null;
    return ((await res.json()) as { recoveryCode: string }).recoveryCode;
  } catch {
    return null;
  }
}

export type ResetResult = { ok: true; recoveryCode: string } | { ok: false; reason: string };

/** Sets a new password using the recovery code. Every device gets signed out. */
export async function resetPassword(username: string, recoveryCode: string, password: string): Promise<ResetResult> {
  try {
    const res = await call('/api/account/reset-password', {
      body: { username: username.trim(), recoveryCode, password },
    });
    const body = (await res.json().catch(() => null)) as { recoveryCode?: string; error?: string } | null;
    if (res.ok && body?.recoveryCode) return { ok: true, recoveryCode: body.recoveryCode };
    return { ok: false, reason: body?.error ?? 'Something went wrong.' };
  } catch {
    return unreachable;
  }
}
