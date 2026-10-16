import { useState, type FormEvent } from 'react';
import type { AccountControls, SyncState } from '../../online/useAccount';
import { playClick } from '../../sound';
import styles from './Settings.module.css';

const SYNC_TEXT: Record<SyncState, string> = {
  syncing: 'Syncing your profile…',
  synced: 'Profile saved to your account',
  offline: 'Server unreachable · Changes save on this device',
};

export default function AccountPanel({ controls }: { controls: AccountControls }) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (controls.account) {
    return (
      <>
        <div className={`${styles.row} ${styles.rowStatic}`}>
          <div className={styles.rowBody}>
            <span className={styles.rowLabel}>Signed in as {controls.account.username}</span>
            <span className={styles.rowSub}>{SYNC_TEXT[controls.sync]}</span>
          </div>
          <button
            type="button"
            className={styles.accountSecondary}
            onClick={() => {
              playClick();
              void controls.signOut();
            }}
          >
            Sign out
          </button>
        </div>
        <p className={styles.accountNote}>
          Your profile, stats and titles follow you to any device you sign in on.
        </p>
      </>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    playClick();
    setBusy(true);
    setError(null);
    const result = mode === 'register'
      ? await controls.register(username, password)
      : await controls.signIn(username, password);
    setBusy(false);
    if (result.ok) setPassword('');
    else setError(result.reason);
  }

  const registering = mode === 'register';
  return (
    <form className={styles.accountForm} onSubmit={submit}>
      <label className={styles.accountField}>
        <span className={styles.rowSub}>Username</span>
        <input
          className={styles.accountInput}
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={30}
        />
      </label>
      <label className={styles.accountField}>
        <span className={styles.rowSub}>Password</span>
        <input
          className={styles.accountInput}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={registering ? 'new-password' : 'current-password'}
          required
          minLength={8}
        />
      </label>
      {error && <p className={styles.accountError} role="alert">{error}</p>}
      <button type="submit" className={styles.accountPrimary} disabled={busy}>
        {busy ? 'One moment…' : registering ? 'Create account' : 'Sign in'}
      </button>
      <button
        type="button"
        className={styles.accountSwitch}
        onClick={() => {
          playClick();
          setMode(registering ? 'signin' : 'register');
          setError(null);
        }}
      >
        {registering ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
      <p className={styles.accountNote}>
        {registering
          ? 'No email needed. There is no password reset yet, so pick one you will remember.'
          : 'Sign in to keep your profile, stats and titles across devices.'}
      </p>
    </form>
  );
}
