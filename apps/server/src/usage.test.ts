import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createUsageStore, registerUsageRoutes } from './usage';

const DAY = 24 * 60 * 60 * 1000;

describe('usage stats', () => {
  it('counts page loads, unique visitors, devices and games per day', () => {
    let now = Date.parse('2026-11-27T12:00:00Z');
    const store = createUsageStore(new DatabaseSync(':memory:'), () => now);
    const visit = (ip: string, signedIn: boolean, device: 'phone' | 'desktop') =>
      store.record({ kind: 'visit', ip, signedIn, device });
    visit('1.1.1.1', false, 'phone');
    visit('1.1.1.1', false, 'phone');
    visit('2.2.2.2', true, 'desktop');
    store.record({ kind: 'bot_start', ip: '1.1.1.1', signedIn: false, device: 'phone' });
    store.count('online_start');
    store.count('online_end');
    const today = store.daily().at(-1)!;
    expect(today).toEqual({
      day: '2026-11-27', pageLoads: 3, uniqueVisitors: 2, signedIn: 1, guests: 2, phone: 2, desktop: 1,
      botStarted: 1, botFinished: 0, onlineStarted: 1, onlineFinished: 1,
    });
    expect(store.daily()).toHaveLength(30);
  });

  it('never stores an IP, and the same visitor gets a new hash the next day', () => {
    let now = Date.parse('2026-11-27T12:00:00Z');
    const db = new DatabaseSync(':memory:');
    const store = createUsageStore(db, () => now);
    store.record({ kind: 'visit', ip: '203.0.113.9', signedIn: false, device: null });
    now += DAY;
    store.record({ kind: 'visit', ip: '203.0.113.9', signedIn: false, device: null });
    const rows = db.prepare('SELECT * FROM usage_event').all() as { visitor: string }[];
    expect(JSON.stringify(rows)).not.toContain('203.0.113.9');
    expect(rows[0].visitor).not.toBe(rows[1].visitor);
    // Yesterday's salt is gone, so yesterday's hashes can't be recomputed.
    expect(db.prepare('SELECT day FROM usage_salt').all()).toEqual([{ day: '2026-11-28' }]);
  });

  it('keeps raw events 30 days, then only daily totals', () => {
    let now = Date.parse('2026-10-01T12:00:00Z');
    const db = new DatabaseSync(':memory:');
    const store = createUsageStore(db, () => now);
    store.record({ kind: 'visit', ip: '1.1.1.1', signedIn: false, device: 'phone' });
    now += 30 * DAY;
    store.rollUp();
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_event').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT day, pageLoads, uniqueVisitors FROM usage_daily').all()).toEqual([
      { day: '2026-10-01', pageLoads: 1, uniqueVisitors: 1 },
    ]);
  });
});

describe('usage route', () => {
  it('rate limits each visitor by their real address, not the proxy', async () => {
    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    const store = createUsageStore(new DatabaseSync(':memory:'));
    registerUsageRoutes(app, store);
    const send = (ip: string) =>
      app.inject({ method: 'POST', url: '/api/usage', headers: { 'fly-client-ip': ip }, payload: { kind: 'visit' } });
    for (let i = 0; i < 60; i++) expect((await send('198.51.100.1')).statusCode).toBe(200);
    expect((await send('198.51.100.1')).statusCode).toBe(429);
    expect((await send('198.51.100.2')).statusCode).toBe(200);
    expect(store.daily().at(-1)).toMatchObject({ pageLoads: 61, uniqueVisitors: 2 });
    await app.close();
  });
});
