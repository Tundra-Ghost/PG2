import { useEffect, useRef } from 'react';
import styles from './LeaveMatchDialog.module.css';

interface LeaveMatchDialogProps {
  onLeave: () => void;
  onStay: () => void;
  heading?: string;
  text?: string;
  leaveLabel?: string;
  stayLabel?: string;
}

/** Asks before leaving a match that would count as a loss. Also asks before abandoning a saved game. */
export default function LeaveMatchDialog({
  onLeave,
  onStay,
  heading = 'Leave this match?',
  text = 'It will count as a loss.',
  leaveLabel = 'Leave',
  stayLabel = 'Keep playing',
}: LeaveMatchDialogProps) {
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Staying is the safe choice, so it gets focus and Escape.
    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div className={styles.backdrop} onClick={onStay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-match-title"
        aria-describedby="leave-match-text"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="leave-match-title" className={styles.heading}>{heading}</h2>
        <p id="leave-match-text" className={styles.text}>{text}</p>
        <div className={styles.actions}>
          <button ref={stayRef} className={styles.stay} onClick={onStay}>{stayLabel}</button>
          <button className={styles.leave} onClick={onLeave}>{leaveLabel}</button>
        </div>
      </div>
    </div>
  );
}
