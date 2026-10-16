import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FriendStatus } from '@pigeon-chess/game-core';
import type { SocialControls } from '../../online/useSocial';
import { playClick } from '../../sound';
import styles from './Friends.module.css';

interface FriendsProps {
  /** The signed-in username, or null for a guest. */
  account: string | null;
  social: SocialControls;
  onBack: () => void;
  onSignIn: () => void;
  /** Opens the Online screen and sits down in this room. */
  onPlay: (roomId: string) => void;
}

const STATUS_TEXT: Record<FriendStatus, string> = {
  online: 'Online',
  'in-game': 'In a game',
  offline: 'Offline',
};

export default function Friends({ account, social, onBack, onSignIn, onPlay }: FriendsProps) {
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  if (!account) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <button className={styles.back} onClick={onBack}>&lt;- Back</button>
          <h1 className={styles.title}>Friends</h1>
          <p className={styles.lede}>
            Sign in to add friends, see who is online, send messages and challenge them to a game.
          </p>
          <button className={styles.primary} onClick={() => { playClick(); onSignIn(); }}>
            Sign in or create an account
          </button>
        </div>
      </div>
    );
  }

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    playClick();
    const res = await social.request(name);
    setNotice(res.ok ? { ok: true, text: `Request sent to ${name.trim()}.` } : { ok: false, text: res.reason });
    if (res.ok) setName('');
  }

  const { friends, incoming, outgoing } = social.list;

  return (
    <div className={styles.root}>
      <div className={`${styles.card} ${styles.wide}`}>
        <button className={styles.back} onClick={onBack}>&lt;- Back</button>
        <h1 className={styles.title}>Friends</h1>
        {!social.connected && <p className={styles.error}>Connecting to the game server…</p>}

        <div className={`${styles.layout} ${social.open ? styles.chatOpen : ''}`}>
          <section className={styles.side} aria-label="Friends list">
            <form className={styles.addRow} onSubmit={addFriend}>
              <input
                className={styles.input}
                value={name}
                onChange={e => { setName(e.target.value); setNotice(null); }}
                placeholder="Add by username"
                aria-label="Username to add"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
              />
              <button className={styles.secondary} type="submit" disabled={!name.trim()}>Add</button>
            </form>
            {notice && <p className={notice.ok ? styles.ok : styles.error}>{notice.text}</p>}

            {incoming.length > 0 && (
              <div className={styles.group}>
                <h2 className={styles.groupTitle}>Requests</h2>
                {incoming.map(username => (
                  <div key={username} className={styles.row}>
                    <span className={styles.name}>{username}</span>
                    <button className={styles.secondary} onClick={() => { playClick(); void social.respond(username, true); }}>Accept</button>
                    <button className={styles.ghost} onClick={() => void social.respond(username, false)}>Decline</button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.group}>
              <h2 className={styles.groupTitle}>Friends</h2>
              {friends.length === 0 && <p className={styles.hint}>No friends yet. Add someone by their username.</p>}
              {friends.map(friend => (
                <button
                  key={friend.username}
                  className={`${styles.friend} ${social.open === friend.username ? styles.friendOpen : ''}`}
                  onClick={() => { playClick(); social.openConversation(friend.username); }}
                >
                  <span className={`${styles.dot} ${styles[friend.status === 'in-game' ? 'inGame' : friend.status]}`} aria-hidden="true" />
                  <span className={styles.friendText}>
                    <span className={styles.name}>{friend.username}</span>
                    <span className={styles.status}>{STATUS_TEXT[friend.status]}</span>
                  </span>
                  {friend.unread > 0 && <span className={styles.badge} aria-label={`${friend.unread} unread`}>{friend.unread}</span>}
                </button>
              ))}
            </div>

            {outgoing.length > 0 && (
              <div className={styles.group}>
                <h2 className={styles.groupTitle}>Waiting on</h2>
                {outgoing.map(username => (
                  <div key={username} className={styles.row}>
                    <span className={styles.name}>{username}</span>
                    <button className={styles.ghost} onClick={() => void social.remove(username)}>Cancel</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {social.open && (
            <Conversation
              key={social.open}
              me={account}
              friend={social.open}
              social={social}
              onPlay={onPlay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ConversationProps {
  me: string;
  friend: string;
  social: SocialControls;
  onPlay: (roomId: string) => void;
}

function Conversation({ me, friend, social, onPlay }: ConversationProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [social.messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    const res = await social.send(draft);
    if (res.ok) setDraft('');
    setError(res.ok ? null : res.reason);
  }

  async function challenge() {
    playClick();
    const res = await social.challenge(friend);
    if (res.ok) onPlay(res.roomId);
    else setError(res.reason);
  }

  return (
    <section className={styles.chat} aria-label={`Conversation with ${friend}`}>
      <header className={styles.chatHeader}>
        <button className={styles.ghost} onClick={() => social.openConversation(null)} aria-label="Back to friends">&lt;-</button>
        <span className={styles.chatName}>{friend}</span>
        <button className={styles.secondary} onClick={() => void challenge()}>Challenge</button>
      </header>

      <div className={styles.messages}>
        {social.messages.length === 0 && <p className={styles.hint}>No messages yet. Say hello, or challenge them to a game.</p>}
        {social.messages.map(message => (
          <div key={message.id} className={message.from === me ? styles.mine : styles.theirs}>
            <p className={styles.bubble}>{message.text}</p>
            {message.roomId && (
              <button className={styles.secondary} onClick={() => { playClick(); onPlay(message.roomId!); }}>
                {message.from === me ? `Open game ${message.roomId}` : `Join game ${message.roomId}`}
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <form className={styles.addRow} onSubmit={send}>
        <input
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={`Message ${friend}`}
          aria-label={`Message ${friend}`}
          maxLength={500}
        />
        <button className={styles.secondary} type="submit" disabled={!draft.trim()}>Send</button>
      </form>

      <div className={styles.chatFooter}>
        {confirmRemove ? (
          <>
            <span className={styles.hint}>Remove {friend} from your friends?</span>
            <button className={styles.ghost} onClick={() => { void social.remove(friend); social.openConversation(null); }}>Remove</button>
            <button className={styles.ghost} onClick={() => setConfirmRemove(false)}>Keep</button>
          </>
        ) : (
          <button className={styles.ghost} onClick={() => setConfirmRemove(true)}>Remove friend</button>
        )}
      </div>
    </section>
  );
}
