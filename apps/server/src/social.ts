import type { DatabaseSync } from 'node:sqlite';
import type { Server } from 'socket.io';
import {
  MAX_DM_CHARS,
  type DirectMessage,
  type Friend,
  type FriendList,
  type FriendStatus,
  type SocialAck,
  type SocialClientEvents,
  type SocialServerEvents,
} from '@pigeon-chess/game-core';
import type { Accounts } from './accounts';
import type { Player, RoomManager } from './rooms';

/** Messages kept per conversation when history is fetched. */
const DM_HISTORY = 100;
/** Direct messages one player may send per DM_WINDOW_MS. */
const DM_BURST = 10;
const DM_WINDOW_MS = 10_000;
const MAX_FRIENDS = 200;

type Ok<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

/** Friendships and direct messages, in the accounts database. */
export class SocialStore {
  private readonly q;

  constructor(db: DatabaseSync) {
    // One row per pair, smaller user id first, so a pair can't appear twice.
    db.exec(`CREATE TABLE IF NOT EXISTS friendship (
      userA TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      userB TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      requestedBy TEXT NOT NULL,
      accepted INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (userA, userB)
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS direct_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      toId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      roomId TEXT,
      at INTEGER NOT NULL,
      readAt INTEGER
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS direct_message_pair ON direct_message (fromId, toId, id)');

    this.q = {
      userByName: db.prepare('SELECT id, username FROM user WHERE username = ?'),
      pair: db.prepare('SELECT requestedBy, accepted FROM friendship WHERE userA = ? AND userB = ?'),
      insertPair: db.prepare('INSERT INTO friendship (userA, userB, requestedBy, accepted, createdAt) VALUES (?, ?, ?, 0, ?)'),
      acceptPair: db.prepare('UPDATE friendship SET accepted = 1 WHERE userA = ? AND userB = ?'),
      deletePair: db.prepare('DELETE FROM friendship WHERE userA = ? AND userB = ?'),
      countFor: db.prepare('SELECT COUNT(*) AS n FROM friendship WHERE userA = ? OR userB = ?'),
      pairsFor: db.prepare(`SELECT f.requestedBy, f.accepted, u.id AS otherId, u.username AS other
        FROM friendship f JOIN user u ON u.id = CASE WHEN f.userA = ? THEN f.userB ELSE f.userA END
        WHERE f.userA = ? OR f.userB = ? ORDER BY u.username`),
      unread: db.prepare('SELECT fromId, COUNT(*) AS n FROM direct_message WHERE toId = ? AND readAt IS NULL GROUP BY fromId'),
      insertDm: db.prepare('INSERT INTO direct_message (fromId, toId, text, roomId, at) VALUES (?, ?, ?, ?, ?)'),
      history: db.prepare(`SELECT * FROM (
          SELECT d.id, d.text, d.roomId, d.at, f.username AS "from", t.username AS "to"
          FROM direct_message d JOIN user f ON f.id = d.fromId JOIN user t ON t.id = d.toId
          WHERE (d.fromId = ? AND d.toId = ?) OR (d.fromId = ? AND d.toId = ?)
          ORDER BY d.id DESC LIMIT ?
        ) ORDER BY id`),
      markRead: db.prepare('UPDATE direct_message SET readAt = ? WHERE toId = ? AND fromId = ? AND readAt IS NULL'),
    };
  }

  findUser(username: string): Player | null {
    const row = this.q.userByName.get(username.trim().toLowerCase()) as { id: string; username: string } | undefined;
    return row ? { id: row.id, username: row.username } : null;
  }

  private key(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  areFriends(a: string, b: string): boolean {
    const row = this.q.pair.get(...this.key(a, b)) as { accepted: number } | undefined;
    return row?.accepted === 1;
  }

  /** Sends a request, or accepts theirs if they asked first. */
  request(me: Player, otherName: string): Ok<{ other: Player; accepted: boolean }> {
    const other = this.findUser(otherName);
    if (!other) return { ok: false, reason: 'No player with that username.' };
    if (other.id === me.id) return { ok: false, reason: "That's you!" };
    const [a, b] = this.key(me.id, other.id);
    const row = this.q.pair.get(a, b) as { requestedBy: string; accepted: number } | undefined;
    if (row?.accepted) return { ok: false, reason: `You and ${other.username} are already friends.` };
    if (row && row.requestedBy === me.id) return { ok: false, reason: 'Request already sent.' };
    if (row) {
      this.q.acceptPair.run(a, b);
      return { ok: true, other, accepted: true };
    }
    if ((this.q.countFor.get(me.id, me.id) as { n: number }).n >= MAX_FRIENDS) {
      return { ok: false, reason: 'Your friends list is full.' };
    }
    this.q.insertPair.run(a, b, me.id, Date.now());
    return { ok: true, other, accepted: false };
  }

  respond(me: Player, otherName: string, accept: boolean): Ok<{ other: Player }> {
    const other = this.findUser(otherName);
    const [a, b] = other ? this.key(me.id, other.id) : ['', ''];
    const row = other ? (this.q.pair.get(a, b) as { requestedBy: string; accepted: number } | undefined) : undefined;
    if (!other || !row || row.accepted || row.requestedBy === me.id) return { ok: false, reason: 'No request from that player.' };
    if (accept) this.q.acceptPair.run(a, b);
    else this.q.deletePair.run(a, b);
    return { ok: true, other };
  }

  /** Unfriends, or cancels a request either way. */
  remove(me: Player, otherName: string): Ok<{ other: Player }> {
    const other = this.findUser(otherName);
    if (!other) return { ok: false, reason: 'No player with that username.' };
    this.q.deletePair.run(...this.key(me.id, other.id));
    return { ok: true, other };
  }

  /** Accepted friends' ids, for presence fan-out. */
  friendIds(me: string): string[] {
    return (this.q.pairsFor.all(me, me, me) as { accepted: number; otherId: string }[])
      .filter(row => row.accepted)
      .map(row => row.otherId);
  }

  list(me: string, statusOf: (userId: string) => FriendStatus): FriendList {
    const unread = new Map(
      (this.q.unread.all(me) as { fromId: string; n: number }[]).map(row => [row.fromId, row.n]),
    );
    const list: FriendList = { friends: [], incoming: [], outgoing: [] };
    for (const row of this.q.pairsFor.all(me, me, me) as { requestedBy: string; accepted: number; otherId: string; other: string }[]) {
      if (row.accepted) {
        const friend: Friend = { username: row.other, status: statusOf(row.otherId), unread: unread.get(row.otherId) ?? 0 };
        list.friends.push(friend);
      } else if (row.requestedBy === me) {
        list.outgoing.push(row.other);
      } else {
        list.incoming.push(row.other);
      }
    }
    return list;
  }

  sendDm(from: Player, to: Player, text: string, roomId: string | null = null): DirectMessage {
    const at = Date.now();
    const result = this.q.insertDm.run(from.id, to.id, text, roomId, at);
    return { id: Number(result.lastInsertRowid), from: from.username, to: to.username, text, roomId, at };
  }

  history(me: string, other: string): DirectMessage[] {
    return this.q.history.all(me, other, other, me, DM_HISTORY) as unknown as DirectMessage[];
  }

  markRead(me: string, from: string): void {
    this.q.markRead.run(Date.now(), me, from);
  }
}

/**
 * Who is around: a player is online while any /social socket of theirs is
 * connected, and in a game while they hold a connected seat.
 */
export class Presence {
  private social = new Map<string, number>();
  private seated = new Map<string, number>();

  constructor(private readonly onChange: (userId: string, status: FriendStatus) => void) {}

  status(userId: string): FriendStatus {
    if ((this.seated.get(userId) ?? 0) > 0) return 'in-game';
    return (this.social.get(userId) ?? 0) > 0 ? 'online' : 'offline';
  }

  private bump(map: Map<string, number>, userId: string, delta: number): void {
    const before = this.status(userId);
    map.set(userId, Math.max(0, (map.get(userId) ?? 0) + delta));
    const after = this.status(userId);
    if (after !== before) this.onChange(userId, after);
  }

  socialConnected(userId: string, delta: 1 | -1): void {
    this.bump(this.social, userId, delta);
  }

  seatChanged(userId: string, delta: 1 | -1): void {
    this.bump(this.seated, userId, delta);
  }
}

function cleanText(raw: unknown, max: number): Ok<{ text: string }> {
  const text = (typeof raw === 'string' ? raw : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'Say something first.' };
  if (text.length > max) return { ok: false, reason: `Keep messages under ${max} characters.` };
  return { ok: true, text };
}

interface SocialData {
  player: Player;
}

/** Wires the /social namespace. Returns the presence tracker for the game namespace to update. */
export function attachSocial(io: Server, accounts: Accounts, rooms: RoomManager): Presence {
  const store = new SocialStore(accounts.db);
  // The game namespace has its own event types; this one speaks the social contract.
  const nsp = (io as unknown as Server<SocialClientEvents, SocialServerEvents, Record<string, never>, SocialData>).of('/social');
  const userRoom = (userId: string) => `user:${userId}`;
  const usernameOf = accounts.db.prepare('SELECT username FROM user WHERE id = ?');

  const presence = new Presence((userId, status) => {
    const self = (usernameOf.get(userId) as { username: string } | undefined)?.username;
    if (!self) return;
    for (const friendId of store.friendIds(userId)) {
      nsp.to(userRoom(friendId)).emit('friend:status', { username: self, status });
    }
  });

  nsp.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('Sign in to see friends.'));
    accounts
      .playerFor(token)
      .then(player => {
        if (!player) return next(new Error('Sign in to see friends.'));
        socket.data.player = player;
        next();
      })
      .catch(() => next(new Error('Sign in to see friends.')));
  });

  nsp.on('connection', socket => {
    const me: Player = socket.data.player;
    void socket.join(userRoom(me.id));
    presence.socialConnected(me.id, 1);
    const sentAt: number[] = [];

    const ack = <T>(raw: unknown) => (typeof raw === 'function' ? (raw as (res: T) => void) : () => {});
    const changed = (...userIds: string[]) => {
      for (const id of userIds) nsp.to(userRoom(id)).emit('friends:changed');
    };

    socket.on('friends:list', rawAck => {
      ack<FriendList>(rawAck)(store.list(me.id, id => presence.status(id)));
    });

    socket.on('friends:request', (req, rawAck) => {
      const res = store.request(me, String(req?.username ?? ''));
      if (res.ok) changed(me.id, res.other.id);
      ack<SocialAck>(rawAck)(res.ok ? { ok: true } : res);
    });

    socket.on('friends:respond', (req, rawAck) => {
      const res = store.respond(me, String(req?.username ?? ''), req?.accept === true);
      if (res.ok) changed(me.id, res.other.id);
      ack<SocialAck>(rawAck)(res.ok ? { ok: true } : res);
    });

    socket.on('friends:remove', (req, rawAck) => {
      const res = store.remove(me, String(req?.username ?? ''));
      if (res.ok) changed(me.id, res.other.id);
      ack<SocialAck>(rawAck)(res.ok ? { ok: true } : res);
    });

    const friendNamed = (name: unknown): Player | null => {
      const other = store.findUser(String(name ?? ''));
      return other && store.areFriends(me.id, other.id) ? other : null;
    };

    const throttled = () => {
      const now = Date.now();
      while (sentAt.length && now - sentAt[0] >= DM_WINDOW_MS) sentAt.shift();
      if (sentAt.length >= DM_BURST) return true;
      sentAt.push(now);
      return false;
    };

    const deliver = (message: DirectMessage, from: Player, to: Player) => {
      nsp.to(userRoom(from.id)).emit('dm:message', message);
      nsp.to(userRoom(to.id)).emit('dm:message', message);
    };

    socket.on('dm:history', (req, rawAck) => {
      const other = friendNamed(req?.username);
      if (!other) return ack<DirectMessage[]>(rawAck)([]);
      store.markRead(me.id, other.id);
      ack<DirectMessage[]>(rawAck)(store.history(me.id, other.id));
    });

    socket.on('dm:read', req => {
      const other = friendNamed(req?.username);
      if (other) store.markRead(me.id, other.id);
    });

    socket.on('dm:send', (req, rawAck) => {
      const reply = ack<SocialAck>(rawAck);
      const other = friendNamed(req?.username);
      if (!other) return reply({ ok: false, reason: 'You can only message friends.' });
      const text = cleanText(req?.text, MAX_DM_CHARS);
      if (!text.ok) return reply(text);
      if (throttled()) return reply({ ok: false, reason: 'Slow down a little.' });
      deliver(store.sendDm(me, other, text.text), me, other);
      reply({ ok: true });
    });

    socket.on('friends:challenge', (req, rawAck) => {
      const reply = ack<{ ok: true; roomId: string } | { ok: false; reason: string }>(rawAck);
      const other = friendNamed(req?.username);
      if (!other) return reply({ ok: false, reason: 'You can only challenge friends.' });
      if (throttled()) return reply({ ok: false, reason: 'Slow down a little.' });
      const room = rooms.create(me);
      if (!room.ok) return reply(room);
      // Nobody is sitting in it yet: the challenger joins from the Online screen.
      rooms.setConnected(room.roomId, 'white', false);
      deliver(store.sendDm(me, other, `${me.username} challenges you to a game!`, room.roomId), me, other);
      reply({ ok: true, roomId: room.roomId });
    });

    socket.on('disconnect', () => presence.socialConnected(me.id, -1));
  });

  return presence;
}
