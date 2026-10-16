import { useState, type FormEvent } from 'react';
import { sendFeedback, type FeedbackKind } from '../../online/feedback';
import { playClick } from '../../sound';
import styles from './Settings.module.css';

const KINDS: { id: FeedbackKind; label: string; placeholder: string }[] = [
  { id: 'bug', label: 'Bug', placeholder: 'What happened, and what did you expect? Steps to repeat it help a lot.' },
  { id: 'idea', label: 'Idea', placeholder: 'A modifier, a feature, something that would make it more fun…' },
  { id: 'other', label: 'Other', placeholder: 'Anything else on your mind.' },
];

/** Sends a bug report or idea, with the screen and match details attached automatically. */
export default function FeedbackPanel({ context }: { context: () => Record<string, unknown> }) {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    playClick();
    setBusy(true);
    const sent = await sendFeedback(kind, message, context());
    setBusy(false);
    if (sent.ok) {
      setMessage('');
      setResult({ ok: true, text: 'Thanks! Viktor has filed it under "urgent".' });
    } else {
      setResult({ ok: false, text: sent.reason });
    }
  }

  const current = KINDS.find(k => k.id === kind)!;
  return (
    <form className={styles.accountForm} onSubmit={submit}>
      <div className={styles.kindRow} role="radiogroup" aria-label="Feedback type">
        {KINDS.map(k => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            className={`${styles.kindBtn} ${kind === k.id ? styles.kindBtnOn : ''}`}
            onClick={() => {
              playClick();
              setKind(k.id);
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <textarea
        className={`${styles.accountInput} ${styles.feedbackText}`}
        value={message}
        onChange={e => {
          setMessage(e.target.value);
          setResult(null);
        }}
        placeholder={current.placeholder}
        aria-label="Your feedback"
        maxLength={2000}
        required
        minLength={3}
      />
      {result && (
        <p className={result.ok ? styles.accountSuccess : styles.accountError} role="status">
          {result.text}
        </p>
      )}
      <button type="submit" className={styles.accountPrimary} disabled={busy || message.trim().length < 3}>
        {busy ? 'Sending…' : 'Send feedback'}
      </button>
      <p className={styles.accountNote}>
        We attach the screen you were on, your match setup and your device so we can reproduce it. Nothing else.
      </p>
    </form>
  );
}
