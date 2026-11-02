import { playClick } from '../../sound';
import styles from '../OnlineMatch/OnlineMatch.module.css';

interface LinkAccountGateProps {
  /** A saved session is still being checked. */
  checking: boolean;
  playerName: string;
  onLink: () => void;
  onSignIn: () => void;
  onBack: () => void;
}

/** Online play needs an account. Guests see this in place of the lobby. */
export default function LinkAccountGate({ checking, playerName, onLink, onSignIn, onBack }: LinkAccountGateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <button
          className={styles.back}
          onClick={() => {
            playClick();
            onBack();
          }}
        >
          &lt;- Back
        </button>
        <h1 className={styles.title}>Play Online</h1>
        {checking ? (
          <p className={styles.lede}>Checking your account…</p>
        ) : (
          <>
            <p className={styles.lede}>
              Online play needs an account. Link one to keep <strong>{playerName}</strong> and its progress
              on every device.
            </p>
            <button className={styles.primary} onClick={onLink}>
              Link account
            </button>
            <button className={styles.secondary} onClick={onSignIn}>
              I already have an account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
