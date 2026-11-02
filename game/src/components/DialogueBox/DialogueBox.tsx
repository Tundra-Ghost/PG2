import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MatchChatEntry } from '../../matchFeed';
import styles from './DialogueBox.module.css';

interface DialogueBoxProps {
  entry: MatchChatEntry;
  onDismiss: () => void;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AvatarIcon({ entry, className }: { entry: MatchChatEntry; className: string }) {
  if (entry.portraitSrc) {
    return <img src={entry.portraitSrc} alt="" className={`${className} ${styles.avatarImg}`} />;
  }
  if (entry.avatarIcon) {
    return <span className={`${className} ${styles.avatarEmoji}`}>{entry.avatarIcon}</span>;
  }
  return (
    <span className={`${className} ${styles.avatarInitial}`}>{entry.avatarLabel ?? '?'}</span>
  );
}

export default function DialogueBox({ entry, onDismiss }: DialogueBoxProps) {
  const [count, setCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (exitRef.current) clearTimeout(exitRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setExiting(true);
    exitRef.current = setTimeout(onDismiss, 300);
  }, [clearTimers, onDismiss]);

  // Reset on new entry
  useEffect(() => {
    clearTimers();
    setCount(0);
    setRevealed(false);
    setExiting(false);
    return clearTimers;
  }, [entry.id, clearTimers]);

  // Typewriter
  useEffect(() => {
    if (revealed || count >= entry.text.length) return;
    const t = setTimeout(() => setCount(c => c + 1), 26);
    return () => clearTimeout(t);
  }, [revealed, count, entry.text.length]);

  const done = revealed || count >= entry.text.length;
  const displayText = done ? entry.text : entry.text.slice(0, count);

  // Auto-dismiss after text completes
  useEffect(() => {
    if (!done || exiting) return;
    autoRef.current = setTimeout(dismiss, 2800);
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [done, exiting, dismiss]);

  const isPlayer = entry.source === 'player';
  const themeClass = styles[`theme${cap(entry.dialogueTheme ?? 'npc')}`] ?? '';
  const exprClass = styles[`expression${cap(entry.dialogueExpression ?? 'neutral')}`] ?? '';

  return (
    <div
      className={`${styles.root} ${exiting ? styles.rootExit : styles.rootEnter}`}
    >
      <button
        type="button"
        className={`${styles.box} ${themeClass} ${isPlayer ? styles.boxPlayer : ''}`}
        onClick={() => {
          if (!done) {
            clearTimers();
            setRevealed(true);
          } else {
            dismiss();
          }
        }}
        aria-label={done ? 'Advance dialogue' : 'Skip typewriter animation'}
      >
        <div className={`${styles.nameplateRow} ${isPlayer ? styles.nameplateRowPlayer : ''}`}>
          <AvatarIcon entry={entry} className={`${styles.avatar} ${exprClass}`} />
          <span className={styles.nameplate}>{entry.author}</span>
        </div>

        <div className={styles.textArea}>
          <span className={styles.text}>
            {displayText}
            {!done && (
              <span className={styles.cursor} aria-hidden="true">
                ▌
              </span>
            )}
          </span>
        </div>

        <div className={styles.hint} aria-hidden="true">
          {done ? '▶  Tap to continue' : '▶  Tap to reveal'}
        </div>
      </button>
    </div>
  );
}

interface DialogueStageProps {
  entry: MatchChatEntry | null;
  onDismiss: () => void;
  /** The phone match drawer is open: sit above it instead of behind it. */
  raised?: boolean;
}

/**
 * The RPG text box, floating over the match near the bottom of the screen.
 * One per match screen, so it shows on every screen size.
 */
export function DialogueStage({ entry, onDismiss, raised = false }: DialogueStageProps) {
  if (!entry) return null;
  // On the body, so no panel's stacking order can paint over it.
  return createPortal(
    <div className={`${styles.stage} ${raised ? styles.stageRaised : ''}`}>
      <DialogueBox key={entry.id} entry={entry} onDismiss={onDismiss} />
    </div>,
    document.body,
  );
}

/**
 * Speaks chat lines one at a time as they arrive. Lines already there when the
 * match opens, or several at once (history after a rejoin), go straight to the log.
 */
export function useDialogueQueue(entries: MatchChatEntry[]) {
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<MatchChatEntry[]>([]);

  useEffect(() => {
    const before = seen.current;
    seen.current = new Set(entries.map(entry => entry.id));
    if (!before) return;
    const fresh = entries.filter(entry => !before.has(entry.id));
    if (fresh.length === 1) setQueue(prev => [...prev, fresh[0]]);
  }, [entries]);

  const dismiss = useCallback(() => setQueue(prev => prev.slice(1)), []);
  const current = queue[0] ?? null;
  return useMemo(() => ({ current, dismiss }), [current, dismiss]);
}
