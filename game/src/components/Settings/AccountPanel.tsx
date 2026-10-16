import { useState, type FormEvent } from 'react';
import type { AccountControls, SyncState } from '../../online/useAccount';
import { playClick } from '../../sound';
import styles from './Settings.module.css';

const SYNC_TEXT: Record<SyncState, string> = {
  syncing: 'Syncing your profile…',
  synced: 'Profile saved to your account',
  offline: 'Server unreachable · Changes save on this device',
};

type Mode = 'signin' | 'register' | 'reset';

function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.accountForm}>
      <span className={styles.rowLabel}>Save your recovery code</span>
      <p className={styles.accountNote}>
        If you forget your password, this code lets you set a new one. Keep it somewhere safe, like a
        notes app. It is shown only once and works once.
      </p>
      <code className={styles.recoveryCode}>{code}</code>
      <button
        type="button"
        className={styles.accountSecondary}
        onClick={() => {
          playClick();
          navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? 'Copied' : 'Copy code'}
      </button>
      <button
        type="button"
        className={styles.accountPrimary}
        onClick={() => {
          playClick();
          onDone();
        }}
      >
        I saved it
      </button>
    </div>
  );
}

export default function AccountPanel({ controls }: { controls: AccountControls }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (controls.recoveryCode) {
    return <RecoveryCode code={controls.recoveryCode} onDone={controls.dismissRecoveryCode} />;
  }

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
              setMode('signin');
              void controls.signOut();
            }}
          >
            Sign out
          </button>
        </div>
        <div className={`${styles.row} ${styles.rowStatic}`}>
          <div className={styles.rowBody}>
            <span className={styles.rowLabel}>Recovery code</span>
            <span className={styles.rowSub}>Lost yours? A new one replaces the old</span>
          </div>
          <button
            type="button"
            className={styles.accountSecondary}
            onClick={() => {
              playClick();
              void controls.newRecoveryCode();
            }}
          >
            New code
          </button>
        </div>
        <p className={styles.accountNote}>
          Your profile, stats, titles and online games follow you to any device you sign in on.
        </p>
      </>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    playClick();
    setBusy(true);
    setError(null);
    const result =
      mode === 'register' ? await controls.register(username, password)
      : mode === 'reset' ? await controls.resetPassword(username, code, password)
      : await controls.signIn(username, password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      setCode('');
      setMode('signin');
    } else {
      setError(result.reason);
    }
  }

  function switchTo(next: Mode) {
    playClick();
    setMode(next);
    setError(null);
  }

  const SUBMIT: Record<Mode, string> = { signin: 'Sign in', register: 'Create account', reset: 'Set new password' };
  const NOTE: Record<Mode, string> = {
    signin: 'Sign in to keep your profile, stats, titles and online games across devices.',
    register: 'No email needed. You will get a recovery code in case you forget your password.',
    reset: 'Enter the recovery code you saved when you made your account. You will get a new one.',
  };

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
      {mode === 'reset' && (
        <label className={styles.accountField}>
          <span className={styles.rowSub}>Recovery code</span>
          <input
            className={styles.accountInput}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        </label>
      )}
      <label className={styles.accountField}>
        <span className={styles.rowSub}>{mode === 'reset' ? 'New password' : 'Password'}</span>
        <input
          className={styles.accountInput}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={8}
        />
      </label>
      {error && <p className={styles.accountError} role="alert">{error}</p>}
      <button type="submit" className={styles.accountPrimary} disabled={busy}>
        {busy ? 'One moment…' : SUBMIT[mode]}
      </button>
      <div className={styles.accountLinks}>
        {mode !== 'signin' && (
          <button type="button" className={styles.accountSwitch} onClick={() => switchTo('signin')}>
            Back to sign in
          </button>
        )}
        {mode === 'signin' && (
          <>
            <button type="button" className={styles.accountSwitch} onClick={() => switchTo('register')}>
              Create an account
            </button>
            <button type="button" className={styles.accountSwitch} onClick={() => switchTo('reset')}>
              Forgot password?
            </button>
          </>
        )}
      </div>
      <p className={styles.accountNote}>{NOTE[mode]}</p>
    </form>
  );
}
