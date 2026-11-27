import { useEffect, useState } from 'react';
import { adminGet } from './adminApi';
import styles from './Admin.module.css';

interface DailyTotals {
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

interface Stats {
  accounts: { total: number; active1: number; active7: number; active30: number; newPerDay: { day: string; count: number }[] };
  daily: DailyTotals[];
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
    </div>
  );
}

const sum = (rows: DailyTotals[], key: keyof Omit<DailyTotals, 'day'>) => rows.reduce((n, row) => n + row[key], 0);

/** Accounts and anonymous visitor stats for the last 30 days. */
export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminGet<Stats>('/stats').then(setStats, () => setError('Could not load stats.'));
  }, []);
  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!stats) return <p className={styles.text}>Loading…</p>;

  const { accounts, daily } = stats;
  const newByDay = new Map(accounts.newPerDay.map(row => [row.day, row.count]));
  const rows = [...daily].reverse();
  return (
    <>
      <section className={styles.section} aria-labelledby="admin-accounts">
        <h2 id="admin-accounts" className={styles.heading}>Accounts</h2>
        <div className={styles.tiles}>
          <Tile label="Total" value={accounts.total} />
          <Tile label="Active 24 h" value={accounts.active1} />
          <Tile label="Active 7 days" value={accounts.active7} />
          <Tile label="Active 30 days" value={accounts.active30} />
          <Tile label="New, 30 days" value={accounts.newPerDay.reduce((n, row) => n + row.count, 0)} />
        </div>
      </section>
      <section className={styles.section} aria-labelledby="admin-visitors">
        <h2 id="admin-visitors" className={styles.heading}>Visitors, last 30 days</h2>
        <div className={styles.tiles}>
          <Tile label="Page loads" value={sum(daily, 'pageLoads')} />
          <Tile label="Signed in / guest" value={`${sum(daily, 'signedIn')} / ${sum(daily, 'guests')}`} />
          <Tile label="Phone / desktop" value={`${sum(daily, 'phone')} / ${sum(daily, 'desktop')}`} />
          <Tile label="Bot games" value={`${sum(daily, 'botFinished')} of ${sum(daily, 'botStarted')} done`} />
          <Tile label="Online games" value={`${sum(daily, 'onlineFinished')} of ${sum(daily, 'onlineStarted')} done`} />
        </div>
        <p className={styles.text}>Unique visitors are counted per day with a salted hash that changes daily. No IP addresses are kept.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Loads</th>
                <th scope="col">Unique</th>
                <th scope="col">Signed in</th>
                <th scope="col">Guest</th>
                <th scope="col">Phone</th>
                <th scope="col">Desktop</th>
                <th scope="col">Bot games</th>
                <th scope="col">Online games</th>
                <th scope="col">New accounts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{row.pageLoads}</td>
                  <td>{row.uniqueVisitors}</td>
                  <td>{row.signedIn}</td>
                  <td>{row.guests}</td>
                  <td>{row.phone}</td>
                  <td>{row.desktop}</td>
                  <td>{row.botFinished} / {row.botStarted}</td>
                  <td>{row.onlineFinished} / {row.onlineStarted}</td>
                  <td>{newByDay.get(row.day) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.text}>Games are shown as finished / started.</p>
      </section>
    </>
  );
}
