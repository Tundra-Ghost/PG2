import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import type { Accounts } from './accounts';

/**
 * Anonymous usage stats for the admin dashboard.
 *
 * Privacy: no IP address is stored. A visitor is a hash of the IP and browser
 * with a salt that changes every UTC day, so the same person counts once a day
 * and cannot be followed from one day to the next. Past salts are deleted.
 * Raw events are kept 30 days; after that only the daily totals remain.
 */
export const EVENT_KINDS = ['visit', 'bot_start', 'bot_end', 'online_start', 'online_end'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type Device = 'phone' | 'desktop';

export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const EVENTS_PER_WINDOW = 60;
const WINDOW_MS = 10 * 60 * 1000;

export interface DailyTotals {
  day: string;
  pageLoads: number;
  uniqueVisitors: number;
  signedIn: number;
  guests: number;
  phone: number;
  desktop: number;
  botStarted: number;
  botFinished: number;
  onlineStarted: number;
  onlineFinished: number;
}

export interface AccountStats {
  total: number;
  active1: number;
  active7: number;
  active30: number;
  /** New accounts per day for the last 30 days, oldest first. */
  newPerDay: { day: string; count: number }[];
}

export interface UsageStore {
  record(entry: { kind: EventKind; ip: string; userAgent: string; signedIn: boolean; device: Device | null }): void;
  /** An event the server sees itself (online games), with no visitor behind it. */
  count(kind: EventKind): void;
  /** Moves events older than the retention window into daily totals and drops old salts. */
  rollUp(): void;
  /** One row per day for the last `days` days, oldest first. */
  daily(days?: number): DailyTotals[];
  accounts(): AccountStats;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The last `days` UTC days ending today, oldest first. */
function lastDays(now: number, days: number): string[] {
  return Array.from({ length: days }, (_, i) => dayOf(now - (days - 1 - i) * DAY_MS));
}

export function createUsageStore(db: DatabaseSync, now: () => number = Date.now): UsageStore {
  db.exec(`CREATE TABLE IF NOT EXISTS usage_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS usage_event (
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    visitor TEXT NOT NULL,
    signedIn INTEGER NOT NULL,
    device TEXT
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS usage_event_day ON usage_event (day)');
  db.exec(`CREATE TABLE IF NOT EXISTS usage_daily (
    day TEXT PRIMARY KEY,
    pageLoads INTEGER NOT NULL, uniqueVisitors INTEGER NOT NULL,
    signedIn INTEGER NOT NULL, guests INTEGER NOT NULL,
    phone INTEGER NOT NULL, desktop INTEGER NOT NULL,
    botStarted INTEGER NOT NULL, botFinished INTEGER NOT NULL,
    onlineStarted INTEGER NOT NULL, onlineFinished INTEGER NOT NULL
  )`);

  const readSalt = db.prepare('SELECT salt FROM usage_salt WHERE day = ?');
  const writeSalt = db.prepare('INSERT OR IGNORE INTO usage_salt (day, salt) VALUES (?, ?)');
  const dropSalts = db.prepare('DELETE FROM usage_salt WHERE day < ?');
  const insert = db.prepare('INSERT INTO usage_event (day, kind, visitor, signedIn, device) VALUES (?, ?, ?, ?, ?)');
  const totalsFor = db.prepare(`SELECT
      SUM(kind = 'visit') AS pageLoads,
      COUNT(DISTINCT CASE WHEN kind = 'visit' THEN visitor END) AS uniqueVisitors,
      SUM(kind = 'visit' AND signedIn = 1) AS signedIn,
      SUM(kind = 'visit' AND signedIn = 0) AS guests,
      SUM(kind = 'visit' AND device = 'phone') AS phone,
      SUM(kind = 'visit' AND device = 'desktop') AS desktop,
      SUM(kind = 'bot_start') AS botStarted,
      SUM(kind = 'bot_end') AS botFinished,
      SUM(kind = 'online_start') AS onlineStarted,
      SUM(kind = 'online_end') AS onlineFinished
    FROM usage_event WHERE day = ?`);
  const oldDays = db.prepare('SELECT DISTINCT day FROM usage_event WHERE day < ?');
  const saveDaily = db.prepare(`INSERT OR REPLACE INTO usage_daily
    (day, pageLoads, uniqueVisitors, signedIn, guests, phone, desktop, botStarted, botFinished, onlineStarted, onlineFinished)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const dropDay = db.prepare('DELETE FROM usage_event WHERE day = ?');
  const readDaily = db.prepare('SELECT * FROM usage_daily WHERE day = ?');

  const saltFor = (day: string): string => {
    const found = readSalt.get(day) as { salt: string } | undefined;
    if (found) return found.salt;
    writeSalt.run(day, randomBytes(32).toString('hex'));
    dropSalts.run(day);
    return (readSalt.get(day) as { salt: string }).salt;
  };

  const totals = (day: string): DailyTotals => {
    const stored = readDaily.get(day) as DailyTotals | undefined;
    if (stored) return { ...stored };
    const row = totalsFor.get(day) as Record<string, number | null>;
    const n = (key: string) => Number(row[key] ?? 0);
    return {
      day,
      pageLoads: n('pageLoads'),
      uniqueVisitors: n('uniqueVisitors'),
      signedIn: n('signedIn'),
      guests: n('guests'),
      phone: n('phone'),
      desktop: n('desktop'),
      botStarted: n('botStarted'),
      botFinished: n('botFinished'),
      onlineStarted: n('onlineStarted'),
      onlineFinished: n('onlineFinished'),
    };
  };

  // Account tables belong to Better Auth, so these are prepared on first use.
  const countUsers = () => db.prepare('SELECT COUNT(*) AS n FROM user');
  const newUsers = () => db.prepare('SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS count FROM user WHERE createdAt >= ? GROUP BY day');
  // Active: a session refreshed, or a profile saved, inside the window.
  const activeUsers = () => db.prepare(`SELECT COUNT(*) AS n FROM user WHERE
    EXISTS (SELECT 1 FROM session WHERE session.userId = user.id AND session.updatedAt >= ?)
    OR EXISTS (SELECT 1 FROM profile WHERE profile.userId = user.id AND profile.updatedAt >= ?)`);

  return {
    record({ kind, ip, userAgent, signedIn, device }) {
      const day = dayOf(now());
      const visitor = createHash('sha256').update(`${saltFor(day)}|${ip}|${userAgent}`).digest('hex').slice(0, 32);
      insert.run(day, kind, visitor, signedIn ? 1 : 0, device);
    },
    count(kind) {
      insert.run(dayOf(now()), kind, '-', 0, null);
    },
    rollUp() {
      const today = dayOf(now());
      dropSalts.run(today);
      const cutoff = dayOf(now() - (RETENTION_DAYS - 1) * DAY_MS);
      for (const { day } of oldDays.all(cutoff) as { day: string }[]) {
        const t = totals(day);
        saveDaily.run(t.day, t.pageLoads, t.uniqueVisitors, t.signedIn, t.guests, t.phone, t.desktop, t.botStarted, t.botFinished, t.onlineStarted, t.onlineFinished);
        dropDay.run(day);
      }
    },
    daily(days = RETENTION_DAYS) {
      return lastDays(now(), days).map(totals);
    },
    accounts() {
      const at = (daysAgo: number) => now() - daysAgo * DAY_MS;
      const active = (daysAgo: number) => Number((activeUsers().get(new Date(at(daysAgo)).toISOString(), at(daysAgo)) as { n: number }).n);
      const days = lastDays(now(), RETENTION_DAYS);
      const counts = new Map(
        (newUsers().all(`${days[0]}T00:00:00.000Z`) as { day: string; count: number }[]).map(row => [row.day, Number(row.count)]),
      );
      return {
        total: Number((countUsers().get() as { n: number }).n),
        active1: active(1),
        active7: active(7),
        active30: active(30),
        newPerDay: days.map(day => ({ day, count: counts.get(day) ?? 0 })),
      };
    },
  };
}

/** Rate-limited per IP: stats are nice to have, never worth a flood. */
export function registerUsageRoutes(app: FastifyInstance, store: UsageStore, accounts?: Accounts): void {
  const recent = new Map<string, number[]>();
  const sweep = setInterval(() => {
    store.rollUp();
    recent.clear();
  }, 60 * 60 * 1000);
  sweep.unref();
  app.addHook('onClose', async () => clearInterval(sweep));
  store.rollUp();

  app.post('/api/usage', { bodyLimit: 1024 }, async (request, reply) => {
    const body = (request.body ?? {}) as { kind?: unknown; device?: unknown };
    // Online games are counted on the server, so clients can only send these.
    const kind = (['visit', 'bot_start', 'bot_end'] as const).find(k => k === body.kind);
    if (!kind) return reply.status(400).send({ error: 'Unknown event.' });
    const now = Date.now();
    const sent = (recent.get(request.ip) ?? []).filter(at => now - at < WINDOW_MS);
    if (sent.length >= EVENTS_PER_WINDOW) return reply.status(429).send({ error: 'Too many events.' });
    sent.push(now);
    recent.set(request.ip, sent);
    const device = body.device === 'phone' || body.device === 'desktop' ? body.device : null;
    const signedIn = accounts ? Boolean(await accounts.userIdFor(request.headers).catch(() => null)) : false;
    // Behind Fly's proxy request.ip is the proxy; Fly passes the visitor's address in this header.
    const flyIp = request.headers['fly-client-ip'];
    const ip = typeof flyIp === 'string' && flyIp ? flyIp : request.ip;
    store.record({ kind, ip, userAgent: String(request.headers['user-agent'] ?? '').slice(0, 200), signedIn, device });
    return { ok: true };
  });
}
