import { useEffect, useState } from 'react';
import { modifierName } from '../../online/survey';
import { adminGet } from './adminApi';
import { surveysToCsv, type AdminSurveyResponse } from './surveyCsv';
import styles from './Admin.module.css';

interface QuestionTotals {
  id: string;
  question: string;
  kind: string;
  answered: number;
  average?: number;
  counts?: Record<string, number>;
}

interface SurveyLog {
  responses: AdminSurveyResponse[];
  totals: QuestionTotals[];
  versions: string[];
  modifiers: string[];
}

interface Filter {
  from: string;
  to: string;
  version: string;
  modifier: string;
}

const formatAnswer = (answer: AdminSurveyResponse['answers'][number]['answer']) =>
  Array.isArray(answer) ? answer.join(', ') : String(answer);

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pigeon-chess-surveys-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Every survey answer, newest first, with filters, totals and a CSV download. */
export default function SurveysPanel() {
  const [filter, setFilter] = useState<Filter>({ from: '', to: '', version: '', modifier: '' });
  const [log, setLog] = useState<SurveyLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
    let live = true;
    adminGet<SurveyLog>(`/surveys${query ? `?${query}` : ''}`).then(
      res => live && (setLog(res), setError(null)),
      () => live && setError('Could not load surveys.'),
    );
    return () => {
      live = false;
    };
  }, [filter]);

  const set = (key: keyof Filter) => (event: { target: { value: string } }) => setFilter(f => ({ ...f, [key]: event.target.value }));

  return (
    <>
      <section className={styles.section} aria-labelledby="admin-survey-filters">
        <h2 id="admin-survey-filters" className={styles.heading}>Survey log</h2>
        <div className={styles.filters}>
          <label className={styles.field}>
            From
            <input type="date" className={styles.input} value={filter.from} onChange={set('from')} />
          </label>
          <label className={styles.field}>
            To
            <input type="date" className={styles.input} value={filter.to} onChange={set('to')} />
          </label>
          <label className={styles.field}>
            Version
            <select className={styles.input} value={filter.version} onChange={set('version')}>
              <option value="">All</option>
              {log?.versions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Modifier
            <select className={styles.input} value={filter.modifier} onChange={set('modifier')}>
              <option value="">All</option>
              {log?.modifiers.map(m => <option key={m} value={m}>{modifierName(m)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className={styles.button}
            disabled={!log || log.responses.length === 0}
            onClick={() => log && download(surveysToCsv(log.responses))}
          >
            Download CSV
          </button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {log && <p className={styles.text}>{log.responses.length} response{log.responses.length === 1 ? '' : 's'}</p>}
      </section>

      {log && log.totals.length > 0 && (
        <section className={styles.section} aria-labelledby="admin-survey-totals">
          <h2 id="admin-survey-totals" className={styles.heading}>Totals per question</h2>
          <div className={styles.tiles}>
            {log.totals.map(t => (
              <div key={t.id} className={styles.tile}>
                <span className={styles.tileLabel}>{t.question} ({t.answered})</span>
                {t.average !== undefined && <span className={styles.tileValue}>{t.average.toFixed(1)} / 5</span>}
                {t.kind !== 'scale' && t.counts && (
                  <span className={styles.text}>
                    {Object.entries(t.counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([pick, n]) => `${pick}: ${n}`)
                      .join(' · ')}
                  </span>
                )}
                {t.kind === 'text' && <span className={styles.text}>Free text, see below</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {log && log.responses.length > 0 && (
        <section className={styles.section} aria-labelledby="admin-survey-answers">
          <h2 id="admin-survey-answers" className={styles.heading}>Answers, newest first</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Player</th>
                  <th scope="col">Version</th>
                  <th scope="col">Game</th>
                  <th scope="col">Answers</th>
                </tr>
              </thead>
              <tbody>
                {log.responses.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td>{r.username ?? 'guest'}</td>
                    <td>{String(r.context.version ?? 'unknown')}</td>
                    <td>
                      {[r.context.mode, r.context.result].filter(Boolean).join(', ')}
                      {Array.isArray(r.context.modifiers) && r.context.modifiers.length > 0 && (
                        <> · {(r.context.modifiers as string[]).map(modifierName).join(', ')}</>
                      )}
                    </td>
                    <td>
                      {r.answers.map(a => (
                        <div key={a.id}>
                          <strong>{a.question}</strong> {formatAnswer(a.answer)}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
