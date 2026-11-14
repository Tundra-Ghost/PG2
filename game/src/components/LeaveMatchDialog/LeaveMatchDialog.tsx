import { useEffect, useRef } from 'react';
import styles from './LeaveMatchDialog.module.css';

interface LeaveMatchDialogProps {
  onLeave: () => void;
  onStay: () => void;
}

/** Asks before leaving a match that would count as a loss. */
export default function LeaveMatchDialog({ onLeave, onStay }: LeaveMatchDialogProps) {
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
        <h2 id="leave-match-title" className={styles.heading}>Leave this match?</h2>
        <p id="leave-match-text" className={styles.text}>It will count as a loss.</p>
        <div className={styles.actions}>
          <button ref={stayRef} className={styles.stay} onClick={onStay}>Keep playing</button>
          <button className={styles.leave} onClick={onLeave}>Leave</button>
        </div>
      </div>
    </div>
  );
}
