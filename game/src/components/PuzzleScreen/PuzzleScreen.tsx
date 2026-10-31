import { useState } from 'react';
import {
  PUZZLE_DIFFICULTIES,
  createEmptyPuzzle,
  decodePuzzle,
  describeGoal,
  encodePuzzle,
  validatePuzzle,
  type Puzzle,
} from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import { deletePuzzle, newPuzzleId, readPuzzles, savePuzzle } from '../../puzzles/puzzleStore';
import PuzzleEditor from '../PuzzleEditor/PuzzleEditor';
import styles from './PuzzleScreen.module.css';

interface PuzzleScreenProps {
  onBack: () => void;
  /** Starts a puzzle. Left out while play mode is not wired up. */
  onPlay?: (puzzle: Puzzle) => void;
}

function difficultyLabel(puzzle: Puzzle): string {
  return PUZZLE_DIFFICULTIES.find(d => d.id === puzzle.difficulty)?.label ?? 'Egg';
}

export default function PuzzleScreen({ onBack, onPlay }: PuzzleScreenProps) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>(() => readPuzzles());
  const [editing, setEditing] = useState<Puzzle | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (editing) {
    return (
      <PuzzleEditor
        key={editing.id}
        initial={editing}
        onSave={puzzle => setPuzzles(savePuzzle(puzzle))}
        onBack={() => {
          setEditing(null);
          setPuzzles(readPuzzles());
        }}
      />
    );
  }

  function importCode() {
    playClick();
    try {
      const puzzle = decodePuzzle(code, newPuzzleId());
      setPuzzles(savePuzzle(puzzle));
      setCode('');
      setMessage(`Added "${puzzle.title}".`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That is not a puzzle code.');
    }
  }

  async function copy(puzzle: Puzzle) {
    playClick();
    const text = encodePuzzle(puzzle);
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Copied the code for "${puzzle.title}".`);
    } catch {
      window.prompt('Copy this puzzle code:', text);
    }
  }

  function remove(puzzle: Puzzle) {
    if (!window.confirm(`Delete "${puzzle.title}"?`)) return;
    setPuzzles(deletePuzzle(puzzle.id));
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.button} onClick={onBack}>
          Menu
        </button>
        <div>
          <span className={styles.kicker}>Puzzle mode</span>
          <h1 className={styles.title}>Puzzles</h1>
          <p className={styles.subtitle}>
            Build a position, add modifiers, and set a goal. Share it with a code.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            playClick();
            setEditing({ ...createEmptyPuzzle(newPuzzleId()), seed: (Date.now() % 100000) + 1 });
          }}
        >
          New puzzle
        </button>
      </header>

      <form
        className={styles.importRow}
        onSubmit={event => {
          event.preventDefault();
          importCode();
        }}
      >
        <input
          value={code}
          placeholder="Paste a puzzle code (PC1-…)"
          aria-label="Puzzle code"
          onChange={event => setCode(event.target.value)}
        />
        <button type="submit" className={styles.button} disabled={!code.trim()}>
          Add
        </button>
      </form>
      {message && <p className={styles.message}>{message}</p>}

      {puzzles.length === 0 ? (
        <p className={styles.empty}>No puzzles yet. Make one, or paste a code from a friend.</p>
      ) : (
        <ul className={styles.list}>
          {puzzles.map(puzzle => {
            const ready = validatePuzzle(puzzle).length === 0;
            return (
              <li key={puzzle.id} className={styles.card}>
                <div className={styles.cardText}>
                  <span className={styles.cardMeta}>
                    {difficultyLabel(puzzle)}
                    {puzzle.modifiers.length > 0 &&
                      ` · ${puzzle.modifiers.length} modifier${puzzle.modifiers.length === 1 ? '' : 's'}`}
                    {puzzle.author && ` · by ${puzzle.author}`}
                    {!ready && ' · Draft'}
                  </span>
                  <strong>{puzzle.title}</strong>
                  <span>{describeGoal(puzzle)}</span>
                </div>
                <div className={styles.cardActions}>
                  {onPlay && (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!ready}
                      title={ready ? undefined : 'Open the editor to fix this puzzle'}
                      onClick={() => {
                        playClick();
                        onPlay(puzzle);
                      }}
                    >
                      Play
                    </button>
                  )}
                  <button type="button" className={styles.button} onClick={() => setEditing(puzzle)}>
                    Edit
                  </button>
                  <button type="button" className={styles.button} onClick={() => copy(puzzle)}>
                    Copy code
                  </button>
                  <button type="button" className={styles.button} onClick={() => remove(puzzle)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
