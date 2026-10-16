import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type { Accounts } from './accounts';

/**
 * Optional post-game surveys. Answers carry their own question text and kind,
 * so the client can change the questions without a server change, and the
 * summary can still group them.
 */
export const ANSWER_KINDS = ['scale', 'choice', 'multi', 'text'] as const;
export type AnswerKind = (typeof ANSWER_KINDS)[number];

export interface SurveyAnswer {
  id: string;
  kind: AnswerKind;
  question: string;
  answer: number | string | string[];
}

export interface SurveyResponse {
  id: number;
  createdAt: number;
  survey: string;
  answers: SurveyAnswer[];
  context: Record<string, unknown>;
  username: string | null;
}

const MAX_ANSWERS = 20;
const MAX_TEXT = 2000;
const MAX_CONTEXT_CHARS = 4000;
const SENDS_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;

export interface SurveyStore {
  add(entry: { survey: string; answers: SurveyAnswer[]; context: Record<string, unknown>; userId: string | null; username: string | null }): number;
  list(): SurveyResponse[];
}

export function createSurveyStore(db: DatabaseSync): SurveyStore {
  db.exec(`CREATE TABLE IF NOT EXISTS survey_response (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt INTEGER NOT NULL,
    survey TEXT NOT NULL,
    answers TEXT NOT NULL,
    context TEXT NOT NULL,
    userId TEXT,
    username TEXT
  )`);
  const insert = db.prepare(
    'INSERT INTO survey_response (createdAt, survey, answers, context, userId, username) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const all = db.prepare('SELECT id, createdAt, survey, answers, context, username FROM survey_response ORDER BY id');
  return {
    add(entry) {
      const result = insert.run(
        Date.now(),
        entry.survey,
        JSON.stringify(entry.answers),
        JSON.stringify(entry.context),
        entry.userId,
        entry.username,
      );
      return Number(result.lastInsertRowid);
    },
    list() {
      return (all.all() as (Omit<SurveyResponse, 'answers' | 'context'> & { answers: string; context: string })[]).map(row => ({
        ...row,
        answers: JSON.parse(row.answers) as SurveyAnswer[],
        context: JSON.parse(row.context) as Record<string, unknown>,
      }));
    },
  };
}

/** Keeps well-formed answers and drops anything else. Empty answers are skipped questions. */
export function cleanAnswers(raw: unknown): SurveyAnswer[] {
  if (!Array.isArray(raw)) return [];
  const answers: SurveyAnswer[] = [];
  for (const item of raw.slice(0, MAX_ANSWERS)) {
    if (!item || typeof item !== 'object') continue;
    const { id, kind, question, answer } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > 40) continue;
    if (typeof question !== 'string' || question.length > 200) continue;
    const k = ANSWER_KINDS.find(candidate => candidate === kind);
    if (!k) continue;
    if (k === 'scale') {
      if (typeof answer === 'number' && Number.isInteger(answer) && answer >= 1 && answer <= 5) answers.push({ id, kind: k, question, answer });
    } else if (k === 'multi') {
      if (!Array.isArray(answer)) continue;
      const picks = answer.filter((a): a is string => typeof a === 'string' && a.length > 0 && a.length <= 100).slice(0, 20);
      if (picks.length) answers.push({ id, kind: k, question, answer: picks });
    } else if (typeof answer === 'string') {
      const text = answer.trim();
      if (text && text.length <= (k === 'text' ? MAX_TEXT : 100)) answers.push({ id, kind: k, question, answer: text });
    }
  }
  return answers;
}

/** All responses rolled up per question, ready to paste into a prompt. */
export function surveySummary(responses: SurveyResponse[]): string {
  if (responses.length === 0) return 'No survey responses yet.';
  const lines = [`# Post-game surveys (${responses.length} responses)`, ''];
  const byQuestion = new Map<string, { kind: AnswerKind; question: string; answers: { value: SurveyAnswer['answer']; who: string; context: Record<string, unknown> }[] }>();
  for (const response of responses) {
    for (const answer of response.answers) {
      const group = byQuestion.get(answer.id) ?? { kind: answer.kind, question: answer.question, answers: [] };
      group.answers.push({ value: answer.answer, who: response.username ?? 'guest', context: response.context });
      byQuestion.set(answer.id, group);
    }
  }

  for (const [id, group] of byQuestion) {
    lines.push(`## ${group.question} \`${id}\` (${group.answers.length} answered)`, '');
    if (group.kind === 'scale') {
      const values = group.answers.map(a => a.value as number);
      const average = values.reduce((sum, v) => sum + v, 0) / values.length;
      const histogram = [1, 2, 3, 4, 5].map(n => `${n}: ${values.filter(v => v === n).length}`).join(' · ');
      lines.push(`Average **${average.toFixed(1)} / 5** (${histogram})`, '');
    } else if (group.kind === 'text') {
      for (const a of group.answers) {
        const where = [a.context.mode, a.context.bot, a.context.result].filter(Boolean).join(', ');
        lines.push(`- "${String(a.value)}" (${a.who}${where ? `; ${where}` : ''})`);
      }
      lines.push('');
    } else {
      const counts = new Map<string, number>();
      for (const a of group.answers) {
        for (const pick of Array.isArray(a.value) ? a.value : [String(a.value)]) counts.set(pick, (counts.get(pick) ?? 0) + 1);
      }
      for (const [pick, count] of [...counts].sort((x, y) => y[1] - x[1])) lines.push(`- ${pick}: ${count}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function registerSurveyRoutes(app: FastifyInstance, store: SurveyStore, accounts?: Accounts): void {
  const recent = new Map<string, number[]>();

  app.post('/api/survey', { bodyLimit: 32 * 1024 }, async (request, reply) => {
    const now = Date.now();
    const sent = (recent.get(request.ip) ?? []).filter(at => now - at < WINDOW_MS);
    if (sent.length >= SENDS_PER_WINDOW) return reply.status(429).send({ error: 'Thanks! That is plenty for now.' });

    const body = (request.body ?? {}) as { survey?: unknown; answers?: unknown; context?: unknown };
    const survey = typeof body.survey === 'string' && body.survey.length <= 40 ? body.survey : '';
    const answers = cleanAnswers(body.answers);
    if (!survey) return reply.status(400).send({ error: 'Unknown survey.' });
    if (answers.length === 0) return reply.status(400).send({ error: 'Answer at least one question, or skip.' });
    const rawContext = body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {};
    const context = JSON.stringify(rawContext).length <= MAX_CONTEXT_CHARS ? (rawContext as Record<string, unknown>) : {};

    const player = accounts ? await accounts.playerFromHeaders(request.headers) : null;
    sent.push(now);
    recent.set(request.ip, sent);
    const id = store.add({ survey, answers, context, userId: player?.id ?? null, username: player?.username ?? null });
    return { ok: true, id };
  });
}
