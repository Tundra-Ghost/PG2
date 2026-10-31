import { useMemo, useState } from 'react';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  MAX_PUZZLE_MOVES,
  PUZZLE_DIFFICULTIES,
  PUZZLE_PIECE_TYPES,
  describeGoal,
  encodePuzzle,
  isSharedDraftModifier,
  modifierRegistry,
  validatePuzzle,
  type Color,
  type PieceType,
  type Puzzle,
  type PuzzleGoal,
  type Square,
} from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import PieceArt from '../Piece/PieceArt';
import { ModifierIcon } from '../ModifierIcon/ModifierIcon';
import styles from './PuzzleEditor.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

const PIECE_NAMES: Partial<Record<PieceType, string>> = {
  king: 'King',
  queen: 'Queen',
  rook: 'Rook',
  bishop: 'Bishop',
  knight: 'Knight',
  pawn: 'Pawn',
};

type Tool = { kind: 'piece'; type: PieceType; color: Color } | { kind: 'erase' } | { kind: 'target' };

const START_ROW: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

function startPieces(): Puzzle['pieces'] {
  return FILES.flatMap((file, i) => [
    { square: `${file}1` as Square, type: START_ROW[i], color: 'white' as const },
    { square: `${file}2` as Square, type: 'pawn' as const, color: 'white' as const },
    { square: `${file}7` as Square, type: 'pawn' as const, color: 'black' as const },
    { square: `${file}8` as Square, type: START_ROW[i], color: 'black' as const },
  ]);
}

function goalLimit(goal: PuzzleGoal): number {
  return goal.type === 'survive' ? goal.rounds : goal.moves;
}

function withLimit(goal: PuzzleGoal, limit: number): PuzzleGoal {
  return goal.type === 'survive' ? { ...goal, rounds: limit } : { ...goal, moves: limit };
}

interface PuzzleEditorProps {
  initial: Puzzle;
  onSave: (puzzle: Puzzle) => void;
  onBack: () => void;
}

export default function PuzzleEditor({ initial, onSave, onBack }: PuzzleEditorProps) {
  const [puzzle, setPuzzle] = useState<Puzzle>(initial);
  const [tool, setTool] = useState<Tool>({ kind: 'piece', type: 'queen', color: 'white' });
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const problems = useMemo(() => validatePuzzle(puzzle), [puzzle]);
  const playableMods = useMemo(() => {
    const live = new Set(modifierRegistry.getAll().map(def => def.id));
    return ALL_MODIFIERS.filter(card => live.has(card.id));
  }, []);
  const pieceAt = useMemo(() => new Map(puzzle.pieces.map(p => [p.square, p])), [puzzle.pieces]);
  const target = puzzle.goal.type === 'capture' ? puzzle.goal.target : null;

  function update(change: Partial<Puzzle>) {
    setPuzzle(prev => ({ ...prev, ...change }));
    setDirty(true);
    setNotice(null);
  }

  function handleSquare(square: Square) {
    if (tool.kind === 'target') {
      if (puzzle.goal.type === 'capture') update({ goal: { ...puzzle.goal, target: square } });
      setTool({ kind: 'piece', type: 'queen', color: puzzle.toMove });
      return;
    }
    const rest = puzzle.pieces.filter(p => p.square !== square);
    const current = pieceAt.get(square);
    if (tool.kind === 'erase') {
      if (current) update({ pieces: rest });
      return;
    }
    // Clicking the same piece again takes it off, so mistakes need no tool switch.
    if (current && current.type === tool.type && current.color === tool.color) {
      update({ pieces: rest });
      return;
    }
    // One king per side: placing a king moves it.
    const kept = tool.type === 'king' ? rest.filter(p => !(p.type === 'king' && p.color === tool.color)) : rest;
    update({ pieces: [...kept, { square, type: tool.type, color: tool.color }] });
  }

  function setGoalType(type: PuzzleGoal['type']) {
    const limit = goalLimit(puzzle.goal);
    if (type === 'survive') update({ goal: { type, rounds: limit } });
    else if (type === 'checkmate') update({ goal: { type, moves: limit } });
    else {
      const enemy = puzzle.pieces.find(p => p.color !== puzzle.toMove && p.type !== 'king');
      update({ goal: { type, moves: limit, target: enemy?.square ?? 'd5' } });
      if (!enemy) setTool({ kind: 'target' });
    }
  }

  function addModifier(id: string) {
    if (!id || puzzle.modifiers.some(mod => mod.id === id)) return;
    update({
      modifiers: [...puzzle.modifiers, { id, owner: isSharedDraftModifier(id) ? null : puzzle.toMove }],
    });
  }

  async function copyCode() {
    playClick();
    const code = encodePuzzle(puzzle);
    try {
      await navigator.clipboard.writeText(code);
      setNotice('Puzzle code copied.');
    } catch {
      window.prompt('Copy this puzzle code:', code);
    }
  }

  function save() {
    playClick();
    onSave(puzzle);
    setDirty(false);
    setNotice(problems.length ? 'Saved as a draft. Fix the problems below to play it.' : 'Saved.');
  }

  function back() {
    if (dirty && !window.confirm('Leave without saving your changes?')) return;
    onBack();
  }

  const toolLabel =
    tool.kind === 'target'
      ? 'Click the enemy piece to capture.'
      : tool.kind === 'erase'
        ? 'Click a piece to remove it.'
        : `Click a square to place a ${tool.color} ${PIECE_NAMES[tool.type]?.toLowerCase()}. Click it again to remove it.`;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={back}>
          Back
        </button>
        <div>
          <span className={styles.kicker}>Puzzle creator</span>
          <h1 className={styles.title}>{puzzle.title || 'Untitled puzzle'}</h1>
          <p className={styles.goalLine}>{describeGoal(puzzle)}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={copyCode}>
            Copy code
          </button>
          <button type="button" className={styles.primaryButton} onClick={save}>
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>
      {notice && <p className={styles.notice}>{notice}</p>}

      <main className={styles.layout}>
        <section className={styles.palette} aria-label="Pieces">
          <h2 className={styles.sectionTitle}>Pieces</h2>
          {(['white', 'black'] as const).map(color => (
            <div key={color} className={`${styles.paletteRow} ${color === 'black' ? styles.paletteRowBlack : ''}`}>
              {PUZZLE_PIECE_TYPES.map(type => {
                const active = tool.kind === 'piece' && tool.type === type && tool.color === color;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.paletteButton} ${active ? styles.active : ''}`}
                    aria-pressed={active}
                    title={`${color === 'white' ? 'White' : 'Black'} ${PIECE_NAMES[type]}`}
                    onClick={() => setTool({ kind: 'piece', type, color })}
                  >
                    <PieceArt type={type} color={color} className={styles.paletteArt} />
                  </button>
                );
              })}
            </div>
          ))}
          <div className={styles.paletteTools}>
            <button
              type="button"
              className={`${styles.toolButton} ${tool.kind === 'erase' ? styles.active : ''}`}
              aria-pressed={tool.kind === 'erase'}
              onClick={() => setTool({ kind: 'erase' })}
            >
              Eraser
            </button>
            <button type="button" className={styles.toolButton} onClick={() => update({ pieces: [] })}>
              Clear
            </button>
            <button type="button" className={styles.toolButton} onClick={() => update({ pieces: startPieces() })}>
              Start position
            </button>
          </div>
          <p className={styles.hint}>{toolLabel}</p>
        </section>

        <section className={styles.boardWrap} aria-label="Puzzle board">
          <div className={styles.board}>
            {RANKS.map((rank, r) =>
              FILES.map((file, f) => {
                const square = `${file}${rank}` as Square;
                const piece = pieceAt.get(square);
                const dark = (r + f) % 2 === 1;
                return (
                  <button
                    key={square}
                    type="button"
                    className={`${styles.square} ${dark ? styles.dark : styles.light} ${
                      square === target ? styles.target : ''
                    }`}
                    aria-label={piece ? `${square} ${piece.color} ${piece.type}` : square}
                    onClick={() => handleSquare(square)}
                    onContextMenu={event => {
                      event.preventDefault();
                      if (piece) update({ pieces: puzzle.pieces.filter(p => p.square !== square) });
                    }}
                  >
                    {piece && <PieceArt type={piece.type} color={piece.color} className={styles.squareArt} />}
                    {f === 0 && <span className={styles.rankLabel}>{rank}</span>}
                    {r === 7 && <span className={styles.fileLabel}>{file}</span>}
                  </button>
                );
              }),
            )}
          </div>
        </section>

        <section className={styles.settings} aria-label="Puzzle settings">
          <h2 className={styles.sectionTitle}>Details</h2>
          <label className={styles.field}>
            <span>Title</span>
            <input
              value={puzzle.title}
              maxLength={60}
              onChange={event => update({ title: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Author</span>
            <input
              value={puzzle.author}
              maxLength={30}
              placeholder="Your name"
              onChange={event => update({ author: event.target.value })}
            />
          </label>
          <div className={styles.field}>
            <span>Difficulty</span>
            <div className={styles.segmented}>
              {PUZZLE_DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={puzzle.difficulty === d.id ? styles.active : ''}
                  aria-pressed={puzzle.difficulty === d.id}
                  onClick={() => update({ difficulty: d.id })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Goal</h2>
          <div className={styles.field}>
            <span>Solver (moves first)</span>
            <div className={styles.segmented}>
              {(['white', 'black'] as const).map(color => (
                <button
                  key={color}
                  type="button"
                  className={puzzle.toMove === color ? styles.active : ''}
                  aria-pressed={puzzle.toMove === color}
                  onClick={() => update({ toMove: color })}
                >
                  {color === 'white' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.goalRow}>
            <label className={styles.field}>
              <span>Goal</span>
              <select
                value={puzzle.goal.type}
                onChange={event => setGoalType(event.target.value as PuzzleGoal['type'])}
              >
                <option value="checkmate">Checkmate</option>
                <option value="capture">Capture a piece</option>
                <option value="survive">Survive</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>{puzzle.goal.type === 'survive' ? 'Rounds' : 'Within moves'}</span>
              <select
                value={goalLimit(puzzle.goal)}
                onChange={event => update({ goal: withLimit(puzzle.goal, Number(event.target.value)) })}
              >
                {Array.from({ length: MAX_PUZZLE_MOVES }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {puzzle.goal.type === 'capture' && (
            <button
              type="button"
              className={`${styles.toolButton} ${tool.kind === 'target' ? styles.active : ''}`}
              onClick={() => setTool({ kind: 'target' })}
            >
              {tool.kind === 'target' ? 'Click the target on the board' : `Target: ${puzzle.goal.target} (change)`}
            </button>
          )}

          <h2 className={styles.sectionTitle}>Modifiers</h2>
          {puzzle.modifiers.length === 0 && <p className={styles.hint}>No modifiers. Plain chess rules.</p>}
          <ul className={styles.modList}>
            {puzzle.modifiers.map(mod => {
              const card = ALL_MODIFIERS.find(c => c.id === mod.id);
              const shared = isSharedDraftModifier(mod.id);
              return (
                <li
                  key={mod.id}
                  className={styles.modRow}
                  style={{ '--category-color': card ? CATEGORY_COLORS[card.category] : undefined } as React.CSSProperties}
                >
                  <ModifierIcon id={mod.id} size={28} className={styles.modIcon} />
                  <div className={styles.modText}>
                    <strong>{card?.name ?? mod.id}</strong>
                    <span>{card?.prototypeRules ?? card?.description}</span>
                  </div>
                  <div className={styles.modControls}>
                    {shared ? (
                      <span className={styles.sharedTag} title="Affects both sides">
                        Shared
                      </span>
                    ) : (
                      <div className={styles.segmented} aria-label="Who owns it">
                        {(['white', 'black'] as const).map(color => (
                          <button
                            key={color}
                            type="button"
                            className={mod.owner === color ? styles.active : ''}
                            aria-pressed={mod.owner === color}
                            onClick={() =>
                              update({
                                modifiers: puzzle.modifiers.map(m => (m.id === mod.id ? { ...m, owner: color } : m)),
                              })
                            }
                          >
                            {color === 'white' ? 'White' : 'Black'}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.removeButton}
                      aria-label={`Remove ${card?.name ?? mod.id}`}
                      onClick={() => update({ modifiers: puzzle.modifiers.filter(m => m.id !== mod.id) })}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <label className={styles.field}>
            <span>Add a modifier</span>
            <select value="" onChange={event => addModifier(event.target.value)}>
              <option value="">Choose…</option>
              {playableMods
                .filter(card => !puzzle.modifiers.some(mod => mod.id === card.id))
                .map(card => (
                  <option key={card.id} value={card.id}>
                    {card.categoryName}: {card.name}
                  </option>
                ))}
            </select>
          </label>

          <div className={problems.length ? styles.problems : styles.ready} role="status">
            {problems.length ? (
              <>
                <strong>Not playable yet</strong>
                <ul>
                  {problems.map(problem => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </>
            ) : (
              <strong>Ready to play</strong>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
