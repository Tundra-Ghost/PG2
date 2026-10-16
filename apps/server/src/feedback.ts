import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type { Accounts } from './accounts';

/**
 * Player feedback (bugs, ideas), kept in the accounts database so it can be
 * read back as a prompt: `pnpm --filter @pigeon-chess/server feedback`.
 */
export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const MAX_FEEDBACK_CHARS = 2000;
const MAX_CONTEXT_CHARS = 4000;
/** Per address, so one tab can't flood the table. */
const SENDS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

export interface FeedbackEntry {
  id: number;
  createdAt: number;
  kind: FeedbackKind;
  message: string;
  context: Record<string, unknown>;
  username: string | null;
  status: 'open' | 'done';
}

export interface FeedbackStore {
  add(entry: { kind: FeedbackKind; message: string; context: Record<string, unknown>; userId: string | null; username: string | null }): number;
  list(status?: 'open' | 'done'): FeedbackEntry[];
  markDone(ids: number[]): number;
}

export function createFeedbackStore(db: DatabaseSync): FeedbackStore {
  db.exec(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt INTEGER NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT NOT NULL,
    userId TEXT,
    username TEXT,
    status TEXT NOT NULL DEFAULT 'open'
  )`);
  const insert = db.prepare(
    'INSERT INTO feedback (createdAt, kind, message, context, userId, username) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const all = db.prepare('SELECT * FROM feedback ORDER BY id');
  const byStatus = db.prepare('SELECT * FROM feedback WHERE status = ? ORDER BY id');
  const done = db.prepare("UPDATE feedback SET status = 'done' WHERE id = ?");

  type Row = Omit<FeedbackEntry, 'context'> & { context: string };
  const toEntry = (row: Row): FeedbackEntry => ({ ...row, context: JSON.parse(row.context) as Record<string, unknown> });

  return {
    add(entry) {
      const result = insert.run(
        Date.now(),
        entry.kind,
        entry.message,
        JSON.stringify(entry.context),
        entry.userId,
        entry.username,
      );
      return Number(result.lastInsertRowid);
    },
    list(status) {
      const rows = (status ? byStatus.all(status) : all.all()) as Row[];
      return rows.map(toEntry);
    },
    markDone(ids) {
      return ids.reduce((count, id) => count + Number(done.run(id).changes), 0);
    },
  };
}

/** The open feedback as Markdown, ready to paste into a prompt. */
export function feedbackAsMarkdown(entries: FeedbackEntry[]): string {
  if (entries.length === 0) return 'No open feedback.';
  const lines = [`# Player feedback (${entries.length} open)`, ''];
  for (const entry of entries) {
    const who = entry.username ?? 'guest';
    lines.push(`## #${entry.id} · ${entry.kind} · ${who} · ${new Date(entry.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    lines.push('', entry.message.trim(), '');
    const context = Object.entries(entry.context).filter(([, value]) => value !== null && value !== '' && value !== undefined);
    if (context.length > 0) {
      lines.push('<details><summary>Context</summary>', '');
      for (const [key, value] of context) lines.push(`- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      lines.push('', '</details>', '');
    }
  }
  return lines.join('\n');
}

export function registerFeedbackRoutes(app: FastifyInstance, store: FeedbackStore, accounts?: Accounts): void {
  const recent = new Map<string, number[]>();

  app.post('/api/feedback', { bodyLimit: 16 * 1024 }, async (request, reply) => {
    const now = Date.now();
    const sent = (recent.get(request.ip) ?? []).filter(at => now - at < WINDOW_MS);
    if (sent.length >= SENDS_PER_WINDOW) {
      return reply.status(429).send({ error: 'Thanks! That is plenty for now. Try again in a few minutes.' });
    }

    const body = (request.body ?? {}) as { kind?: unknown; message?: unknown; context?: unknown };
    const kind = FEEDBACK_KINDS.find(k => k === body.kind);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!kind) return reply.status(400).send({ error: 'Pick bug, idea or other.' });
    if (message.length < 3) return reply.status(400).send({ error: 'Tell us a little more.' });
    if (message.length > MAX_FEEDBACK_CHARS) {
      return reply.status(400).send({ error: `Keep it under ${MAX_FEEDBACK_CHARS} characters.` });
    }
    const rawContext = body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {};
    const context = JSON.stringify(rawContext).length <= MAX_CONTEXT_CHARS ? (rawContext as Record<string, unknown>) : {};

    const player = accounts ? await accounts.playerFromHeaders(request.headers) : null;
    sent.push(now);
    recent.set(request.ip, sent);
    const id = store.add({ kind, message, context, userId: player?.id ?? null, username: player?.username ?? null });
    return { ok: true, id };
  });
}
