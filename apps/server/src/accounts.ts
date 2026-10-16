import { DatabaseSync } from 'node:sqlite';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { bearer, username } from 'better-auth/plugins';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Player accounts: username + password, no email. Better Auth owns users and
 * sessions; we add one table holding each player's profile as JSON.
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
  getProfile(userId: string): unknown;
  saveProfile(userId: string, profile: unknown): void;
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

  const readProfile = db.prepare('SELECT data FROM profile WHERE userId = ?');
  const writeProfile = db.prepare(`INSERT INTO profile (userId, data, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`);

  return {
    auth,
    async userIdFor(headers) {
      const session = await auth.api.getSession({ headers: toHeaders(headers) });
      return session?.user.id ?? null;
    },
    getProfile(userId) {
      const row = readProfile.get(userId) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    saveProfile(userId, profile) {
      writeProfile.run(userId, JSON.stringify(profile), Date.now());
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

/** Mounts Better Auth at /api/auth/* and the profile routes at /api/profile. */
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
