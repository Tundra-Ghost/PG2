import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Accounts } from './accounts';
import type { Player } from './rooms';
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
}

/** The admin a guarded request belongs to. Set by the hook, so always present in admin routes. */
export function adminOf(request: FastifyRequest): Player {
  const admin = (request as FastifyRequest & { admin?: Player }).admin;
  if (!admin) throw new Error('admin route without the admin check');
  return admin;
}

export function registerAdminRoutes(app: FastifyInstance, accounts: Accounts, options: AdminOptions): void {
  void app.register(
    async scope => {
      scope.addHook('onRequest', async (request, reply) => {
        const player = options.adminIds.size > 0 ? await accounts.playerFromHeaders(request.headers).catch(() => null) : null;
        if (!player || !options.adminIds.has(player.id)) return reply.status(403).send({ error: 'Forbidden' });
        (request as FastifyRequest & { admin?: Player }).admin = player;
      });

      // Made-up admin paths answer like real ones, so nobody can map the routes.
      scope.setNotFoundHandler((_request, reply) => reply.status(403).send({ error: 'Forbidden' }));

      scope.get('/check', async () => ({ ok: true }));

      scope.get('/overview', async () => ({ server: options.build }));

      scope.get('/surveys', async request => surveyLog(options.surveys.list(), parseSurveyFilter(request.query)));

      scope.get('/stats', async () => ({ accounts: options.usage.accounts(), daily: options.usage.daily() }));
    },
    { prefix: '/api/admin' },
  );
}
