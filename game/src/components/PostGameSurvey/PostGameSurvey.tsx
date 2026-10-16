import { useState } from 'react';
import {
  buildPostGameSurvey,
  sendSurvey,
  type GameSurveyContext,
  type SurveyAnswerValue,
  type SurveyQuestion,
} from '../../online/survey';
import { playClick } from '../../sound';
import styles from './PostGameSurvey.module.css';

interface PostGameSurveyProps {
  context: GameSurveyContext;
  onClose: () => void;
  /** Turns post-game surveys off from now on. */
  onStopAsking: () => void;
}

/** Optional debrief after a finished game. Every question can be left blank. */
export default function PostGameSurvey({ context, onClose, onStopAsking }: PostGameSurveyProps) {
  const [questions] = useState(() => buildPostGameSurvey(context));
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (id: string, value: SurveyAnswerValue) => {
    setAnswers(current => ({ ...current, [id]: value }));
    setError(null);
  };

  async function submit() {
    playClick();
    setBusy(true);
    const res = await sendSurvey(questions, answers, context);
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.reason);
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="survey-title">
      <div className={styles.card}>
        {sent ? (
          <div className={styles.thanks}>
            <h2 id="survey-title" className={styles.title}>Thank you</h2>
            <p className={styles.lede}>Viktor has read it twice and pretended not to.</p>
            <button className={styles.primary} onClick={() => { playClick(); onClose(); }}>Back to the board</button>
          </div>
        ) : (
          <>
            <header className={styles.header}>
              <h2 id="survey-title" className={styles.title}>Quick debrief</h2>
              <p className={styles.lede}>Optional, about 30 seconds. Skip anything you like.</p>
            </header>

            <div className={styles.questions}>
              {questions.map(question => (
                <Question key={question.id} question={question} value={answers[question.id]} onChange={v => set(question.id, v)} />
              ))}
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <footer className={styles.footer}>
              <button className={styles.primary} onClick={() => void submit()} disabled={busy}>
                {busy ? 'Sending…' : 'Send'}
              </button>
              <button className={styles.secondary} onClick={() => { playClick(); onClose(); }}>Skip</button>
            </footer>
            <button
              className={styles.stop}
              onClick={() => {
                playClick();
                onStopAsking();
                onClose();
              }}
            >
              Don&apos;t ask after games (turn back on in Settings)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Question({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: SurveyAnswerValue | undefined;
  onChange: (value: SurveyAnswerValue) => void;
}) {
  const label = <span className={styles.prompt}>{question.prompt}</span>;

  if (question.kind === 'text') {
    return (
      <label className={styles.question}>
        {label}
        <textarea
          className={styles.text}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          maxLength={2000}
          rows={2}
        />
      </label>
    );
  }

  if (question.kind === 'scale') {
    return (
      <fieldset className={styles.question}>
        <legend className={styles.prompt}>{question.prompt}</legend>
        <div className={styles.scale}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              aria-pressed={value === n}
              className={`${styles.option} ${value === n ? styles.optionOn : ''}`}
              onClick={() => { playClick(); onChange(n); }}
            >
              {n}
            </button>
          ))}
        </div>
        {question.scaleLabels && (
          <div className={styles.scaleLabels} aria-hidden="true">
            <span>{question.scaleLabels[0]}</span>
            <span>{question.scaleLabels[1]}</span>
          </div>
        )}
      </fieldset>
    );
  }

  const multi = question.kind === 'multi';
  const picked = multi ? (Array.isArray(value) ? value : []) : [];
  return (
    <fieldset className={styles.question}>
      <legend className={styles.prompt}>
        {question.prompt}
        {multi && <span className={styles.hint}> Pick any</span>}
      </legend>
      <div className={styles.options}>
        {question.options?.map(option => {
          const on = multi ? picked.includes(option) : value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              className={`${styles.option} ${on ? styles.optionOn : ''}`}
              onClick={() => {
                playClick();
                if (!multi) onChange(on ? '' : option);
                else onChange(on ? picked.filter(p => p !== option) : [...picked, option]);
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
