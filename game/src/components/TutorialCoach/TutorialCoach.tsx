import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_STEPS, type TutorialStep } from '../../tutorial';
import { playClick } from '../../sound';
import styles from './TutorialCoach.module.css';

interface TutorialCoachProps {
  step: number;
  onAction: (step: TutorialStep) => void;
  onSkip: () => void;
}

/** True on touch screens, where "hold" replaces "hover". */
function useTouch(): boolean {
  const [touch, setTouch] = useState(() => window.matchMedia?.('(hover: none)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(hover: none)');
    if (!query) return;
    const update = () => setTouch(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return touch;
}

/** The tour's popup: one step at a time, with a way to tuck it away. */
export default function TutorialCoach({ step, onAction, onSkip }: TutorialCoachProps) {
  const touch = useTouch();
  const [hidden, setHidden] = useState(false);
  const current = TUTORIAL_STEPS[step];

  // A new step always shows itself.
  useEffect(() => setHidden(false), [step]);

  if (!current) return null;
  const body = touch && current.touchBody ? current.touchBody : current.body;
  const count = `${step + 1} / ${TUTORIAL_STEPS.length}`;

  return createPortal(
    <div
      className={`${styles.stage} ${
        current.screen === 'game' ? styles.onGame : current.screen === 'draft' ? styles.onDraft : styles.onMenu
      }`}
    >
      {hidden ? (
        <button
          type="button"
          className={styles.pill}
          onClick={() => {
            playClick();
            setHidden(false);
          }}
        >
          Tutorial · {count}
        </button>
      ) : (
        <section className={styles.card} role="dialog" aria-labelledby="tutorial-title">
          <div className={styles.top}>
            <span className={styles.count}>Tutorial · {count}</span>
            <button
              type="button"
              className={styles.hide}
              aria-label="Hide the tutorial"
              onClick={() => {
                playClick();
                setHidden(true);
              }}
            >
              Hide
            </button>
          </div>
          <h2 id="tutorial-title" className={styles.title}>{current.title}</h2>
          <p className={styles.body}>{body}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.skip}
              onClick={() => {
                playClick();
                onSkip();
              }}
            >
              Skip tutorial
            </button>
            {current.action !== 'wait' && (
              <button
                type="button"
                className={styles.next}
                onClick={() => {
                  playClick();
                  onAction(current);
                }}
              >
                {current.button ?? 'Next'}
              </button>
            )}
          </div>
        </section>
      )}
    </div>,
    document.body,
  );
}
