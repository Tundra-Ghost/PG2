import { useEffect, useMemo, useState } from 'react';
import {
  buildPuzzleState,
  chessEngine,
  describeGoal,
  getPuzzleProgress,
  type GameState,
  type Puzzle,
} from '@pigeon-chess/game-core';
import { requestBotMove } from '../../bot/requestBotMove';
import type { AppSettings } from '../../settings';
import { playClick } from '../../sound';
import Board from '../Board/Board';
import ModifierPanel from '../ModifierPanel/ModifierPanel';
import styles from './PuzzlePlay.module.css';

/** The defender. Pigeon searches a few plies deep, so it finds real defences. */
const DEFENDER_BOT = 'pigeon';

interface PuzzlePlayProps {
  puzzle: Puzzle;
  settings: AppSettings;
  onBack: () => void;
  /** Shown as "Back to editor" when the puzzle is being tested. */
  backLabel?: string;
}

export default function PuzzlePlay({ puzzle, settings, onBack, backLabel = 'Puzzles' }: PuzzlePlayProps) {
  const start = useMemo(() => buildPuzzleState(puzzle), [puzzle]);
  const [state, setState] = useState<GameState>(start);
  const [thinking, setThinking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const progress = getPuzzleProgress(puzzle, start, state);
  const solver = puzzle.toMove;
  const defender = solver === 'white' ? 'black' : 'white';

  useEffect(() => setState(start), [start]);

  useEffect(() => {
    if (progress.status !== 'playing') return;
    if (state.status !== 'active' || state.turn !== defender) return;

    let cancelled = false;
    setThinking(true);
    const timer = setTimeout(() => {
      void requestBotMove(DEFENDER_BOT, state, defender).then(move => {
        if (cancelled) return;
        setThinking(false);
        if (move) {
          setState(prev => (prev === state ? chessEngine.applyMove(prev, move) : prev));
        } else if (chessEngine.canShooGerald(state)) {
          setState(prev => (prev === state ? chessEngine.shooGerald(prev) : prev));
        }
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setThinking(false);
    };
  }, [state, defender, progress.status]);

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(null), 2200);
    return () => clearTimeout(timer);
  }, [info]);

  const finished = progress.status !== 'playing';
  const turnLine = finished
    ? null
    : state.turn === solver
      ? 'Your move.'
      : thinking
        ? 'The defender is thinking…'
        : 'Defender to move.';

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            playClick();
            onBack();
          }}
        >
          {backLabel}
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.kicker}>Puzzle{puzzle.author && ` by ${puzzle.author}`}</span>
          <h1 className={styles.title}>{puzzle.title}</h1>
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            playClick();
            setState(start);
          }}
        >
          Restart
        </button>
      </header>

      <main className={styles.layout}>
        <section className={styles.goalPanel} aria-live="polite">
          <span className={styles.kicker}>Goal</span>
          <p className={styles.goal}>{describeGoal(puzzle)}</p>
          <div className={styles.meter} aria-label={`${progress.used} of ${progress.limit} used`}>
            {Array.from({ length: progress.limit }, (_, i) => (
              <span key={i} className={i < progress.used ? styles.pipUsed : styles.pip} />
            ))}
          </div>
          <p
            className={
              progress.status === 'solved' ? styles.solved : progress.status === 'failed' ? styles.failed : styles.status
            }
          >
            {progress.message}
          </p>
          {turnLine && <p className={styles.turn}>{turnLine}</p>}
          {info && <p className={styles.info}>{info}</p>}
          {finished && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                playClick();
                setState(start);
              }}
            >
              {progress.status === 'solved' ? 'Play again' : 'Try again'}
            </button>
          )}
        </section>

        <section className={styles.boardShell}>
          <Board
            state={state}
            onStateChange={next => {
              if (!finished) setState(next);
            }}
            controlColor={solver}
            orientation={solver}
            onInfo={setInfo}
            showLegalMoves={settings.showLegalMoves}
            autoQueen={settings.autoQueen}
            showCoordinates={settings.showCoordinates}
          />
        </section>

        {state.activeModifiers.length > 0 && (
          <section className={styles.modifiers}>
            <ModifierPanel
              state={state}
              playerLabel={solver === 'white' ? 'White (you)' : 'White (defender)'}
              opponentLabel={solver === 'black' ? 'Black (you)' : 'Black (defender)'}
            />
          </section>
        )}
      </main>
    </div>
  );
}
