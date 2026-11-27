import { useEffect, useRef, useState } from 'react';
import { playClick } from '../../sound';
import { GAME_BUILD, describeBuild, type BuildInfo } from '../../version';
import { adminGet } from './adminApi';
import styles from './Admin.module.css';
import StatsPanel from './StatsPanel';
import ModerationPanel from './ModerationPanel';
import SurveysPanel from './SurveysPanel';

type Tab = 'overview' | 'stats' | 'surveys' | 'moderation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'surveys', label: 'Surveys' },
  { id: 'moderation', label: 'Moderation' },
];

function Overview() {
  const [server, setServer] = useState<BuildInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminGet<{ server: BuildInfo }>('/overview').then(
      res => setServer(res.server),
      () => setError('Could not reach the server.'),
    );
  }, []);
  return (
    <section className={styles.section} aria-labelledby="admin-versions">
      <h2 id="admin-versions" className={styles.heading}>Versions</h2>
      <p className={styles.text}>Game: {describeBuild(GAME_BUILD)}</p>
      <p className={styles.text}>Server: {server ? describeBuild(server) : error ?? 'Loading…'}</p>
      {server && server.version !== GAME_BUILD.version && (
        <p className={styles.warn} role="status">
          The game and the server are on different versions. That is normal after a merge that only touched the
          game, because the server redeploys only when server code changes. If server code changed, check the
          Deploy server workflow.
        </p>
      )}
    </section>
  );
}

/** The owner's admin area. The menu shows it only to admins; the server guards every call. */
export default function AdminScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const check = () => {
    setUnreachable(false);
    adminGet('/check').then(
      () => setAllowed(true),
      (err: Error) => (err.message === 'forbidden' ? setAllowed(false) : setUnreachable(true)),
    );
  };
  useEffect(() => {
    heading.current?.focus();
    check();
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            playClick();
            onBack();
          }}
        >
          {'<-'} Back
        </button>
        <h1 ref={heading} tabIndex={-1} className={styles.title}>
          {allowed === false ? 'Not found' : 'Admin'}
        </h1>
        {allowed === false && <p className={styles.text}>There is nothing here.</p>}
        {unreachable && (
          <>
            <p className={styles.error} role="alert">Could not reach the server.</p>
            <button type="button" className={styles.buttonQuiet} onClick={check}>
              Try again
            </button>
          </>
        )}
        {allowed && (
          <>
            <div className={styles.tabs} role="tablist">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                  onClick={() => {
                    playClick();
                    setTab(t.id);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {tab === 'overview' && <Overview />}
              {tab === 'stats' && <StatsPanel />}
              {tab === 'surveys' && <SurveysPanel />}
              {tab === 'moderation' && <ModerationPanel />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
