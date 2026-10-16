/**
 * Socket.IO contract for the /social namespace: friends, presence and direct
 * messages. Signed-in players only; the server rejects guests on connect.
 */

export type FriendStatus = 'offline' | 'online' | 'in-game';

export interface Friend {
  username: string;
  status: FriendStatus;
  /** Direct messages from them you haven't opened yet. */
  unread: number;
}

export interface FriendList {
  friends: Friend[];
  /** People asking to be your friend. */
  incoming: string[];
  /** People you asked, still waiting. */
  outgoing: string[];
}

/** Longest direct message the server accepts. */
export const MAX_DM_CHARS = 500;

export interface DirectMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  /** Set when the message is a game challenge: the room to join. */
  roomId: string | null;
  at: number;
}

export type SocialAck = { ok: true } | { ok: false; reason: string };

export interface SocialClientEvents {
  'friends:list': (ack: (list: FriendList) => void) => void;
  /** Sends a request, or accepts theirs if they already asked you. */
  'friends:request': (req: { username: string }, ack: (res: SocialAck) => void) => void;
  'friends:respond': (req: { username: string; accept: boolean }, ack: (res: SocialAck) => void) => void;
  'friends:remove': (req: { username: string }, ack: (res: SocialAck) => void) => void;
  /** The conversation with a friend, oldest first. Marks it read. */
  'dm:history': (req: { username: string }, ack: (messages: DirectMessage[]) => void) => void;
  'dm:send': (req: { username: string; text: string }, ack: (res: SocialAck) => void) => void;
  'dm:read': (req: { username: string }) => void;
  /** Opens a room with you as White and sends the friend an invite to it. */
  'friends:challenge': (
    req: { username: string },
    ack: (res: { ok: true; roomId: string } | { ok: false; reason: string }) => void,
  ) => void;
}

export interface SocialServerEvents {
  'friend:status': (update: { username: string; status: FriendStatus }) => void;
  /** Requests or friendships changed; fetch the list again. */
  'friends:changed': () => void;
  'dm:message': (message: DirectMessage) => void;
}
