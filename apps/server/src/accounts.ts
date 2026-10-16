import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { bearer, username } from 'better-auth/plugins';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Player } from './rooms';

/**
 * Player accounts: username + password, no email. Better Auth owns users and
 * sessions; we add a table holding each player's profile as JSON, and one
 * holding a recovery code per player, which stands in for an email reset.
 *
 * Everything lives in one SQLite file on the Fly volume next to the saved
 * rooms. Sessions travel as bearer tokens rather than cookies because the
 * site (github.io) and the server (fly.dev) are different sites, and
 * browsers block cookies between them.
 */
export interface AccountOptions {
  /** SQLite file. ':memory:' keeps nothing, which suits tests and local dev. */
  dbPath: string;
  /** Signs session tokens. Must be set (and kept) in production. */
  secret: string;
  /** Public URL of this server, e.g. https://pigeon-chess-server.fly.dev */
  baseURL: string;
  /** Sites allowed to call the account routes. Same list as the socket CORS. */
  trustedOrigins: string[];
}

/** Profiles are the client's own save format, avatar image included; this caps one player's save. */
export const MAX_PROFILE_BYTES = 1024 * 1024;

/** Crockford base32: no I, L, O or U, so codes survive being copied by hand. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12; // 60 bits: far beyond guessing, even without the attempt limit.

/** A fresh recovery code, shown to the player once, e.g. 7K3Q-9XWD-M2HT. */
export function newRecoveryCode(): string {
  const chars = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map(part => part.join('')).join('-');
}

/** Codes are compared without dashes or case, and with the easily confused letters read as digits. */
function hashRecoveryCode(code: string): Buffer {
  const normalized = code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  return createHash('sha256').update(normalized).digest();
}

/** Failed resets allowed per username in RESET_WINDOW_MS. */
const RESET_ATTEMPTS = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000;

export type ResetResult = { ok: true; recoveryCode: string } | { ok: false; reason: string; status: number };

/** Better Auth insists on an email. Players never see this one. */
export function placeholderEmail(name: string): string {
  return `${name.toLowerCase()}@players.pigeon-chess.invalid`;
}

function authConfig(db: DatabaseSync, options: AccountOptions) {
  return {
    database: db,
    secret: options.secret,
    baseURL: options.baseURL,
    basePath: '/api/auth',
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: { enabled: true },
    session: { expiresIn: 60 * 60 * 24 * 30 },
    plugins: [username(), bearer()],
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

function createAuth(db: DatabaseSync, options: AccountOptions) {
  return betterAuth(authConfig(db, options));
}

export type Auth = ReturnType<typeof createAuth>;

export interface Accounts {
  auth: Auth;
  /** Account id for the request's bearer token, or null when signed out. */
  userIdFor(headers: FastifyRequest['headers']): Promise<string | null>;
  /** The player a bearer token belongs to, or null for a missing or dead session. */
  playerFor(token: string): Promise<Player | null>;
  getProfile(userId: string): unknown;
  saveProfile(userId: string, profile: unknown): void;
  /** Replaces the player's recovery code and returns the new one. */
  issueRecoveryCode(userId: string): string;
  /** Sets a new password if the code matches. Signs out every device and issues a new code. */
  resetPassword(username: string, code: string, password: string): Promise<ResetResult>;
  close(): void;
}

export async function createAccounts(options: AccountOptions): Promise<Accounts> {
  const db = new DatabaseSync(options.dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  // Create or update Better Auth's tables (user, session, account, ...)
  // before it starts, or it logs a schema mismatch on every fresh volume.
  const { runMigrations } = await getMigrations(authConfig(db, options));
  await runMigrations();
  const auth = createAuth(db, options);
  db.exec(`CREATE TABLE IF NOT EXISTS profile (
    userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS recovery_code (
    userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    codeHash BLOB NOT NULL,
    createdAt INTEGER NOT NULL
  )`);

  const readProfile = db.prepare('SELECT data FROM profile WHERE userId = ?');
  const writeProfile = db.prepare(`INSERT INTO profile (userId, data, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`);
  const writeCode = db.prepare(`INSERT INTO recovery_code (userId, codeHash, createdAt) VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET codeHash = excluded.codeHash, createdAt = excluded.createdAt`);
  const findCode = db.prepare(
    'SELECT user.id AS userId, recovery_code.codeHash AS codeHash FROM user LEFT JOIN recovery_code ON recovery_code.userId = user.id WHERE user.username = ?',
  );
  const failedResets = new Map<string, { count: number; since: number }>();

  const issueRecoveryCode = (userId: string) => {
    const code = newRecoveryCode();
    writeCode.run(userId, hashRecoveryCode(code), Date.now());
    return code;
  };

  return {
    auth,
    async userIdFor(headers) {
      const session = await auth.api.getSession({ headers: toHeaders(headers) });
      return session?.user.id ?? null;
    },
    async playerFor(token) {
      const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
      if (!session) return null;
      return { id: session.user.id, username: session.user.username ?? session.user.name };
    },
    getProfile(userId) {
      const row = readProfile.get(userId) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    saveProfile(userId, profile) {
      writeProfile.run(userId, JSON.stringify(profile), Date.now());
    },
    issueRecoveryCode,
    async resetPassword(name, code, password) {
      const key = name.trim().toLowerCase();
      const now = Date.now();
      const failures = failedResets.get(key);
      if (failures && now - failures.since < RESET_WINDOW_MS && failures.count >= RESET_ATTEMPTS) {
        return { ok: false, status: 429, reason: 'Too many tries. Wait 15 minutes and try again.' };
      }
      const ctx = await auth.$context;
      const { minPasswordLength, maxPasswordLength } = ctx.password.config;
      if (password.length < minPasswordLength) {
        return { ok: false, status: 400, reason: `Passwords need at least ${minPasswordLength} characters.` };
      }
      if (password.length > maxPasswordLength) return { ok: false, status: 400, reason: 'That password is too long.' };

      const row = findCode.get(key) as { userId: string; codeHash: Uint8Array | null } | undefined;
      const matches = row?.codeHash != null && timingSafeEqual(Buffer.from(row.codeHash), hashRecoveryCode(code));
      if (!row || !matches) {
        const fresh = !failures || now - failures.since >= RESET_WINDOW_MS;
        failedResets.set(key, fresh ? { count: 1, since: now } : { count: failures.count + 1, since: failures.since });
        return { ok: false, status: 400, reason: "That username and recovery code don't match." };
      }

      failedResets.delete(key);
      await ctx.internalAdapter.updatePassword(row.userId, await ctx.password.hash(password));
      await ctx.internalAdapter.deleteUserSessions(row.userId);
      return { ok: true, recoveryCode: issueRecoveryCode(row.userId) };
    },
    close() {
      db.close();
    },
  };
}

function toHeaders(raw: FastifyRequest['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return headers;
}

/** Mounts Better Auth at /api/auth/*, plus our profile and recovery routes. */
export function registerAccountRoutes(app: FastifyInstance, accounts: Accounts): void {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const response = await accounts.auth.handler(
        new Request(url, {
          method: request.method,
          headers: toHeaders(request.headers),
          body: request.method === 'POST' && request.body !== undefined ? JSON.stringify(request.body) : undefined,
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });

  app.post('/api/account/recovery-code', async (request, reply) => {
    const userId = await accounts.userIdFor(request.headers);
    if (!userId) return reply.status(401).send({ error: 'Sign in first.' });
    return { recoveryCode: accounts.issueRecoveryCode(userId) };
  });

  app.post('/api/account/reset-password', async (request, reply) => {
    const body = (request.body ?? {}) as { username?: unknown; recoveryCode?: unknown; password?: unknown };
    if (typeof body.username !== 'string' || typeof body.recoveryCode !== 'string' || typeof body.password !== 'string') {
      return reply.status(400).send({ error: 'Expected a username, recovery code and new password.' });
    }
    const result = await accounts.resetPassword(body.username, body.recoveryCode, body.password);
    if (!result.ok) return reply.status(result.status).send({ error: result.reason });
    return { recoveryCode: result.recoveryCode };
  });

  app.get('/api/profile', async (request, reply) => {
    const userId = await accounts.userIdFor(request.headers);
    if (!userId) return reply.status(401).send({ error: 'Sign in first.' });
    return { profile: accounts.getProfile(userId) };
  });

  app.put('/api/profile', { bodyLimit: MAX_PROFILE_BYTES }, async (request, reply) => {
    const userId = await accounts.userIdFor(request.headers);
    if (!userId) return reply.status(401).send({ error: 'Sign in first.' });
    const profile = (request.body as { profile?: unknown } | undefined)?.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return reply.status(400).send({ error: 'Expected a profile object.' });
    }
    accounts.saveProfile(userId, profile);
    return { ok: true };
  });
}
