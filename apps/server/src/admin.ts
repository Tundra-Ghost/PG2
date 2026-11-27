import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Accounts } from './accounts';
import { MAX_REASON, USERNAME_RE, type Moderation } from './moderation';
import type { Player, RoomManager } from './rooms';
import { parseSurveyFilter, surveyLog, type SurveyStore } from './survey';
import type { UsageStore } from './usage';
import type { BuildInfo } from './version';

/**
 * The owner's admin area. Admin rights come only from the ADMIN_ACCOUNT_IDS
 * setting (a Fly secret), never from code. Every route below /api/admin sits
 * behind one hook that checks the signed-in account on the server; guests and
 * other players get the same bare 403, so nothing hints at what is there.
 */
export function parseAdminIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map(id => id.trim()).filter(Boolean));
}

export interface AdminOptions {
  adminIds: Set<string>;
  build: BuildInfo;
  usage: UsageStore;
  surveys: SurveyStore;
  moderation: Moderation;
  rooms: RoomManager;
  /** Disconnects a player's open sockets, e.g. right after a ban. */
  kick(userId: string): void;
  /** Ends a room and disconnects whoever is in it. */
  endRoom(roomId: string): boolean;
}

/** Trimmed text with control characters removed, or null when empty or too long. */
function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text && text.length <= max ? text : null;
}

/** The admin a guarded request belongs to. Set by the hook, so always present in admin routes. */
export function adminOf(request: FastifyRequest): Player {
  const admin = (request as FastifyRequest & { admin?: Player }).admin;
  if (!admin) throw new Error('admin route without the admin check');
  return admin;
}

export function registerAdminRoutes(app: FastifyInstance, accounts: Accounts, options: AdminOptions): void {
  // The client asks this on every load, so it answers 200 for everyone and only says
  // whether the caller is an admin (#234). Every route below still returns 403.
  app.get('/api/admin/check', async request => {
    const player = options.adminIds.size > 0 ? await accounts.playerFromHeaders(request.headers).catch(() => null) : null;
    return { admin: !!player && options.adminIds.has(player.id) };
  });

  void app.register(
    async scope => {
      scope.addHook('onRequest', async (request, reply) => {
        const player = options.adminIds.size > 0 ? await accounts.playerFromHeaders(request.headers).catch(() => null) : null;
        if (!player || !options.adminIds.has(player.id)) return reply.status(403).send({ error: 'Forbidden' });
        (request as FastifyRequest & { admin?: Player }).admin = player;
      });

      // Made-up admin paths answer like real ones, so nobody can map the routes.
      scope.setNotFoundHandler((_request, reply) => reply.status(403).send({ error: 'Forbidden' }));

      scope.get('/overview', async () => ({ server: options.build }));

      scope.get('/surveys', async request => surveyLog(options.surveys.list(), parseSurveyFilter(request.query)));

      // ── Moderator tools. Every change is written to the audit log. ──
      const { moderation } = options;
      type IdParams = { Params: { id: string } };

      scope.get('/accounts', async request => {
        const q = (request.query as { q?: unknown }).q;
        return { accounts: typeof q === 'string' && q.trim() && q.length <= 40 ? moderation.find(q) : [] };
      });

      scope.get<IdParams>('/accounts/:id', async (request, reply) => {
        const account = moderation.account(request.params.id);
        if (!account) return reply.status(404).send({ error: 'No such account.' });
        const games = options.rooms.adminList().filter(room => room.whiteId === account.id || room.blackId === account.id);
        return { account, games, feedback: moderation.feedbackFrom(account.id) };
      });

      scope.post<IdParams>('/accounts/:id/ban', async (request, reply) => {
        const reason = cleanText((request.body as { reason?: unknown } | undefined)?.reason, MAX_REASON);
        if (!reason) return reply.status(400).send({ error: 'Give a reason.' });
        if (options.adminIds.has(request.params.id)) return reply.status(400).send({ error: 'Admins cannot be banned here.' });
        if (!(await moderation.ban(adminOf(request), request.params.id, reason))) return reply.status(404).send({ error: 'No such account.' });
        options.kick(request.params.id);
        return { ok: true };
      });

      scope.post<IdParams>('/accounts/:id/unban', async (request, reply) => {
        const reason = cleanText((request.body as { reason?: unknown } | undefined)?.reason, MAX_REASON) ?? 'no reason given';
        const result = moderation.unban(adminOf(request), request.params.id, reason);
        if (result === 'missing') return reply.status(404).send({ error: 'No such account.' });
        if (result === 'not banned') return reply.status(409).send({ error: 'That account is not banned.' });
        return { ok: true };
      });

      scope.post<IdParams>('/accounts/:id/rename', async (request, reply) => {
        const name = (request.body as { username?: unknown } | undefined)?.username;
        if (typeof name !== 'string' || !USERNAME_RE.test(name)) {
          return reply.status(400).send({ error: 'Usernames need 3 to 30 letters, numbers, _ or .' });
        }
        const result = await moderation.rename(adminOf(request), request.params.id, name);
        if (result === 'missing') return reply.status(404).send({ error: 'No such account.' });
        if (result === 'taken') return reply.status(409).send({ error: 'That username is taken.' });
        options.kick(request.params.id);
        return { ok: true };
      });

      scope.get('/rooms', async () => ({ rooms: options.rooms.adminList().map(({ whiteId, blackId, ...room }) => room) }));

      scope.post<IdParams>('/rooms/:id/end', async (request, reply) => {
        const reason = cleanText((request.body as { reason?: unknown } | undefined)?.reason, MAX_REASON) ?? 'stuck room';
        if (!options.endRoom(request.params.id)) return reply.status(404).send({ error: 'No such room.' });
        moderation.log(adminOf(request), 'end room', request.params.id, reason);
        return { ok: true };
      });

      scope.get('/audit', async () => ({ entries: moderation.audit() }));

      scope.get('/stats', async () => ({ accounts: options.usage.accounts(), daily: options.usage.daily() }));
    },
    { prefix: '/api/admin' },
  );
}
