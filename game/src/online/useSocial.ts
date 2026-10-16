import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  DirectMessage,
  FriendList,
  SocialAck,
  SocialClientEvents,
  SocialServerEvents,
} from '@pigeon-chess/game-core';
import { readToken } from './account';
import { SERVER_URL } from './useOnlineRoom';

type SocialSocket = Socket<SocialServerEvents, SocialClientEvents>;

const EMPTY: FriendList = { friends: [], incoming: [], outgoing: [] };

export interface SocialControls {
  connected: boolean;
  list: FriendList;
  /** Unread direct messages across all friends. */
  unread: number;
  request(username: string): Promise<SocialAck>;
  respond(username: string, accept: boolean): Promise<SocialAck>;
  remove(username: string): Promise<SocialAck>;
  /** The friend whose conversation is open, and its messages. */
  open: string | null;
  messages: DirectMessage[];
  openConversation(username: string | null): void;
  send(text: string): Promise<SocialAck>;
  /** Opens a room and invites the friend. Resolves to the room code. */
  challenge(username: string): Promise<{ ok: true; roomId: string } | { ok: false; reason: string }>;
}

/**
 * Friends, presence and direct messages over the /social namespace.
 * Connected for as long as a player is signed in, so friends see them online.
 */
export function useSocial(account: string | null): SocialControls {
  const socketRef = useRef<SocialSocket | null>(null);
  const openRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [list, setList] = useState<FriendList>(EMPTY);
  const [open, setOpen] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);

  const refresh = useCallback(() => {
    socketRef.current?.emit('friends:list', next => setList(next));
  }, []);

  useEffect(() => {
    setList(EMPTY);
    setOpen(null);
    openRef.current = null;
    setMessages([]);
    if (!account) return;

    const socket: SocialSocket = io(`${SERVER_URL}/social`, {
      transports: ['websocket'],
      auth: callback => callback({ token: readToken() }),
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('friends:changed', refresh);
    socket.on('friend:status', ({ username, status }) =>
      setList(current => ({
        ...current,
        friends: current.friends.map(friend => (friend.username === username ? { ...friend, status } : friend)),
      })),
    );
    socket.on('dm:message', message => {
      const other = message.from === account ? message.to : message.from;
      if (other === openRef.current) {
        setMessages(current => [...current, message]);
        if (message.from !== account) socket.emit('dm:read', { username: other });
      } else if (message.from !== account) {
        setList(current => ({
          ...current,
          friends: current.friends.map(friend =>
            friend.username === other ? { ...friend, unread: friend.unread + 1 } : friend,
          ),
        }));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [account, refresh]);

  const ask = useCallback(
    <T>(send: (socket: SocialSocket, done: (res: T) => void) => void, offline: T) =>
      new Promise<T>(resolve => {
        const socket = socketRef.current;
        if (!socket?.connected) return resolve(offline);
        send(socket, resolve);
      }),
    [],
  );
  const offline: { ok: false; reason: string } = { ok: false, reason: 'Not connected to the game server.' };

  return {
    connected,
    list,
    unread: list.friends.reduce((sum, friend) => sum + friend.unread, 0),
    request: username => ask<SocialAck>(
      (socket, done) => socket.emit('friends:request', { username: username.trim() }, done),
      offline,
    ),
    respond: (username, accept) => ask<SocialAck>((socket, done) => socket.emit('friends:respond', { username, accept }, done), offline),
    remove: username => ask<SocialAck>((socket, done) => socket.emit('friends:remove', { username }, done), offline),
    open,
    messages,
    openConversation(username) {
      openRef.current = username;
      setOpen(username);
      setMessages([]);
      if (!username) return;
      socketRef.current?.emit('dm:history', { username }, history => {
        if (openRef.current === username) setMessages(history);
      });
      setList(current => ({
        ...current,
        friends: current.friends.map(friend => (friend.username === username ? { ...friend, unread: 0 } : friend)),
      }));
    },
    send: text => {
      const to = openRef.current;
      if (!to) return Promise.resolve({ ok: false, reason: 'Pick a friend first.' });
      return ask<SocialAck>((socket, done) => socket.emit('dm:send', { username: to, text }, done), offline);
    },
    challenge: username => ask<{ ok: true; roomId: string } | { ok: false; reason: string }>((socket, done) => socket.emit('friends:challenge', { username }, done), offline),
  };
}
