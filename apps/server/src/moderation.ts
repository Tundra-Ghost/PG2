import type { DatabaseSync } from 'node:sqlite';
import type { Accounts } from './accounts';
import type { Player } from './rooms';

/**
 * The owner's moderator tools: find an account, ban or unban it, rename an
 * offensive display name. Every change is written to the audit log.
 */
export interface AccountRow {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  banned: { reason: string; bannedAt: number } | null;
}

export interface AuditEntry {
  id: number;
  at: number;
  admin: string;
  action: string;
  target: string;
  detail: string;
}

export const MAX_REASON = 300;
/** Better Auth's username rule: what other players see in games, chat and friends. */
export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

export interface Moderation {
  find(query: string): AccountRow[];
  account(id: string): AccountRow | null;
  /** Feedback this account sent: the closest thing to reports for now. */
  feedbackFrom(id: string): { id: number; createdAt: number; kind: string; message: string }[];
  ban(admin: Player, id: string, reason: string): Promise<boolean>;
  unban(admin: Player, id: string, reason: string): 'ok' | 'missing' | 'not banned';
  /** Changes the username other players see (and signs in with), and the profile's display name. */
  rename(admin: Player, id: string, name: string): Promise<'ok' | 'missing' | 'taken'>;
  log(admin: Player, action: string, target: string, detail: string): void;
  audit(limit?: number): AuditEntry[];
}

export function createModeration(db: DatabaseSync, accounts: Accounts): Moderation {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    adminId TEXT NOT NULL,
    admin TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    detail TEXT NOT NULL
  )`);
  const insertAudit = db.prepare('INSERT INTO admin_audit (at, adminId, admin, action, target, detail) VALUES (?, ?, ?, ?, ?, ?)');
  const readAudit = db.prepare('SELECT id, at, admin, action, target, detail FROM admin_audit ORDER BY id DESC LIMIT ?');
  const select = `SELECT user.id AS id, user.username AS username, user.createdAt AS createdAt,
      account_ban.reason AS reason, account_ban.bannedAt AS bannedAt
    FROM user LEFT JOIN account_ban ON account_ban.userId = user.id`;
  const byName = db.prepare(`${select} WHERE user.username LIKE ? ESCAPE '\\' ORDER BY user.username LIMIT 25`);
  const byId = db.prepare(`${select} WHERE user.id = ?`);
  const insertBan = db.prepare('INSERT OR REPLACE INTO account_ban (userId, reason, bannedAt) VALUES (?, ?, ?)');
  const deleteBan = db.prepare('DELETE FROM account_ban WHERE userId = ?');
  const setName = db.prepare('UPDATE user SET username = ?, displayUsername = ?, name = ? WHERE id = ?');
  const nameOwner = db.prepare('SELECT id FROM user WHERE username = ?');
  const feedback = db.prepare('SELECT id, createdAt, kind, message FROM feedback WHERE userId = ? ORDER BY id DESC LIMIT 50');

  type Row = { id: string; username: string; createdAt: string; reason: string | null; bannedAt: number | null };
  const toAccount = (row: Row): AccountRow => {
    const profile = accounts.getProfile(row.id) as { displayName?: unknown } | null;
    return {
      id: row.id,
      username: row.username,
      displayName: typeof profile?.displayName === 'string' ? profile.displayName : null,
      createdAt: row.createdAt,
      banned: row.reason !== null ? { reason: row.reason, bannedAt: Number(row.bannedAt) } : null,
    };
  };

  const log = (admin: Player, action: string, target: string, detail: string) => {
    insertAudit.run(Date.now(), admin.id, admin.username, action, target, detail);
  };
  const signOutEverywhere = async (id: string) => {
    const ctx = await accounts.auth.$context;
    await ctx.internalAdapter.deleteUserSessions(id);
  };

  const account = (id: string) => {
    const row = byId.get(id) as Row | undefined;
    return row ? toAccount(row) : null;
  };

  return {
    find(query) {
      const pattern = `%${query.trim().toLowerCase().replace(/[\\%_]/g, c => `\\${c}`)}%`;
      return (byName.all(pattern) as Row[]).map(toAccount);
    },
    account,
    feedbackFrom(id) {
      try {
        return feedback.all(id) as { id: number; createdAt: number; kind: string; message: string }[];
      } catch {
        return []; // No feedback table yet.
      }
    },
    async ban(admin, id, reason) {
      const target = account(id);
      if (!target) return false;
      insertBan.run(id, reason, Date.now());
      await signOutEverywhere(id);
      log(admin, 'ban', target.username, reason);
      return true;
    },
    unban(admin, id, reason) {
      const target = account(id);
      if (!target) return 'missing';
      if (!target.banned) return 'not banned';
      deleteBan.run(id);
      log(admin, 'unban', target.username, reason);
      return 'ok';
    },
    async rename(admin, id, name) {
      const target = account(id);
      if (!target) return 'missing';
      const owner = nameOwner.get(name.toLowerCase()) as { id: string } | undefined;
      if (owner && owner.id !== id) return 'taken';
      setName.run(name.toLowerCase(), name, name, id);
      const profile = accounts.getProfile(id);
      if (profile && typeof profile === 'object') accounts.saveProfile(id, { ...(profile as object), displayName: name });
      // Signed-in devices would upload their old copy; signing them out makes them load this one.
      await signOutEverywhere(id);
      log(admin, 'rename', target.username, `${target.displayName ?? target.username} -> ${name}`);
      return 'ok';
    },
    log,
    audit(limit = 200) {
      return readAudit.all(limit) as unknown as AuditEntry[];
    },
  };
}
