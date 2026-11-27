import { useEffect, useRef, useState, type FormEvent } from 'react';
import { playClick } from '../../sound';
import { adminGet, adminPost } from './adminApi';
import styles from './Admin.module.css';

interface AccountRow {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  banned: { reason: string; bannedAt: number } | null;
}

interface RoomRow {
  id: string;
  white: string | null;
  black: string | null;
  status: string;
  moves: number;
  updatedAt: number;
}

interface AccountDetail {
  account: AccountRow;
  games: RoomRow[];
  feedback: { id: number; createdAt: number; kind: string; message: string }[];
}

interface AuditEntry {
  id: number;
  at: number;
  admin: string;
  action: string;
  target: string;
  detail: string;
}

const when = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

function RoomsTable({ rooms, onEnd }: { rooms: RoomRow[]; onEnd?: (id: string) => void }) {
  if (rooms.length === 0) return <p className={styles.text}>No open rooms.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Room</th>
            <th scope="col">White</th>
            <th scope="col">Black</th>
            <th scope="col">Status</th>
            <th scope="col">Moves</th>
            <th scope="col">Last activity (UTC)</th>
            {onEnd && <th scope="col" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rooms.map(room => (
            <tr key={room.id}>
              <td>{room.id}</td>
              <td>{room.white ?? 'empty'}</td>
              <td>{room.black ?? 'empty'}</td>
              <td>{room.status}</td>
              <td>{room.moves}</td>
              <td>{when(room.updatedAt)}</td>
              {onEnd && (
                <td>
                  <button type="button" className={styles.buttonQuiet} onClick={() => onEnd(room.id)}>
                    End room
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountCard({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  // The id this card shows. A slow answer for an account no longer selected is dropped.
  const current = useRef(id);
  current.current = id;
  const load = () => {
    const forId = id;
    return adminGet<AccountDetail>(`/accounts/${encodeURIComponent(forId)}`).then(
      res => current.current === forId && setDetail(res),
      () => current.current === forId && setMessage('Could not load the account.'),
    );
  };
  useEffect(() => {
    setDetail(null);
    setMessage(null);
    void load();
  }, [id]);

  const act = async (path: string, body: unknown, done: string) => {
    playClick();
    try {
      await adminPost(`/accounts/${encodeURIComponent(id)}${path}`, body);
      setMessage(done);
      setReason('');
      setName('');
      await load();
      onChanged();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  if (!detail) return message ? <p className={styles.error} role="alert">{message}</p> : <p className={styles.text}>Loading…</p>;
  const { account } = detail;
  return (
    <section className={styles.section} aria-labelledby="admin-account">
      <h3 id="admin-account" className={styles.heading}>
        {account.username}
        {account.displayName && account.displayName !== account.username ? ` (shown as ${account.displayName})` : ''}
      </h3>
      <p className={styles.text}>
        Joined {account.createdAt.slice(0, 10)} ·{' '}
        {account.banned ? `Banned ${when(account.banned.bannedAt)} UTC: ${account.banned.reason}` : 'Not banned'}
      </p>
      {message && <p className={styles.text} role="status">{message}</p>}

      <form
        className={styles.filters}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void act(account.banned ? '/unban' : '/ban', { reason }, account.banned ? 'Unbanned.' : 'Banned and signed out.');
        }}
      >
        <label className={styles.field}>
          Reason (logged)
          <input className={styles.input} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} required={!account.banned} />
        </label>
        <button type="submit" className={styles.button}>
          {account.banned ? 'Unban' : 'Ban'}
        </button>
      </form>

      <form
        className={styles.filters}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void act('/rename', { username: name }, 'Renamed and signed out. They sign in with the new username.');
        }}
      >
        <label className={styles.field}>
          New username
          <input
            className={styles.input}
            value={name}
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_.]+"
            onChange={e => setName(e.target.value)}
            required
          />
        </label>
        <button type="submit" className={styles.buttonQuiet}>
          Rename
        </button>
      </form>
      <p className={styles.text}>
        Renaming changes the name other players see, which is also the name they sign in with. Tell them the new one.
      </p>

      <h3 className={styles.heading}>Open online games</h3>
      <RoomsTable rooms={detail.games} />

      <h3 className={styles.heading}>Feedback they sent</h3>
      {detail.feedback.length === 0 ? (
        <p className={styles.text}>None.</p>
      ) : (
        detail.feedback.map(f => (
          <p key={f.id} className={styles.text}>
            {when(f.createdAt)} · {f.kind}: {f.message}
          </p>
        ))
      )}
    </section>
  );
}

/** Find accounts, ban or rename them, end stuck rooms, and read the audit log. */
export default function ModerationPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AccountRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = (q: string) =>
    adminGet<{ accounts: AccountRow[] }>(`/accounts?q=${encodeURIComponent(q)}`).then(
      res => setResults(res.accounts),
      () => setError('Search failed.'),
    );

  const refresh = () => {
    setError(null);
    adminGet<{ rooms: RoomRow[] }>('/rooms').then(res => setRooms(res.rooms), () => setError('Could not load rooms.'));
    adminGet<{ entries: AuditEntry[] }>('/audit').then(res => setAudit(res.entries), () => setError('Could not load the audit log.'));
  };
  useEffect(refresh, []);

  const endRoom = async (id: string) => {
    playClick();
    setError(null);
    if (!window.confirm(`End room ${id}? Both players are disconnected and the game is deleted.`)) return;
    try {
      await adminPost(`/rooms/${encodeURIComponent(id)}/end`, { reason: 'stuck room' });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <section className={styles.section} aria-labelledby="admin-find">
        <h2 id="admin-find" className={styles.heading}>Find an account</h2>
        <form
          className={styles.filters}
          onSubmit={event => {
            event.preventDefault();
            playClick();
            setError(null);
            void search(query);
          }}
        >
          <label className={styles.field}>
            Username
            <input className={styles.input} value={query} maxLength={40} onChange={e => setQuery(e.target.value)} required />
          </label>
          <button type="submit" className={styles.button}>Search</button>
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {results && results.length === 0 && <p className={styles.text}>No accounts match.</p>}
        {results && results.length > 0 && (
          <div className={styles.tabs}>
            {results.map(account => (
              <button
                key={account.id}
                type="button"
                className={`${styles.tab} ${selected === account.id ? styles.tabActive : ''}`}
                aria-pressed={selected === account.id}
                onClick={() => {
                  playClick();
                  setSelected(account.id);
                }}
              >
                {account.username}
                {account.banned ? ' (banned)' : ''}
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <AccountCard
          id={selected}
          onChanged={() => {
            refresh();
            if (query.trim()) void search(query);
          }}
        />
      )}

      <section className={styles.section} aria-labelledby="admin-rooms">
        <h2 id="admin-rooms" className={styles.heading}>Open online rooms</h2>
        <RoomsTable rooms={rooms} onEnd={id => void endRoom(id)} />
      </section>

      <section className={styles.section} aria-labelledby="admin-audit">
        <h2 id="admin-audit" className={styles.heading}>Audit log</h2>
        {audit.length === 0 ? (
          <p className={styles.text}>No admin actions yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When (UTC)</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Target</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(entry => (
                  <tr key={entry.id}>
                    <td>{when(entry.at)}</td>
                    <td>{entry.admin}</td>
                    <td>{entry.action}</td>
                    <td>{entry.target}</td>
                    <td>{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
