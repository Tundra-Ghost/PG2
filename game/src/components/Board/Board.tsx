import { useCallback, useState } from 'react';
import type { GameState, Square } from '../../engine/types';
import { chessEngine } from '../../engine/ChessEngine';
import { buildMove } from '../../engine/gameLoop';
import SquareComponent from '../Square/Square';
import styles from './Board.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

interface BoardProps {
  state: GameState;
  onStateChange: (next: GameState) => void;
}

function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 !== 0;
}

export default function Board({ state, onStateChange }: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const lastMove = state.moveHistory[state.moveHistory.length - 1];
  const lastFrom = lastMove?.move.from;
  const lastTo = lastMove?.move.to;

  // Find king squares in check
  const whiteInCheck = chessEngine.isInCheck(state, 'white');
  const blackInCheck = chessEngine.isInCheck(state, 'black');

  let checkSquare: Square | null = null;
  if (whiteInCheck || blackInCheck) {
    const checkColor = whiteInCheck ? 'white' : 'black';
    for (const piece of state.pieces.values()) {
      if (piece.type === 'king' && piece.color === checkColor) {
        checkSquare = piece.square;
        break;
      }
    }
  }

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (state.status !== 'active') return;

      const clickedPiece = state.pieces.get(square);

      // Nothing selected yet
      if (!selected) {
        if (clickedPiece && clickedPiece.color === state.turn) {
          setSelected(square);
          setLegalMoves(chessEngine.getLegalMoves(state, square));
        }
        return;
      }

      // Re-select own piece
      if (clickedPiece && clickedPiece.color === state.turn && square !== selected) {
        setSelected(square);
        setLegalMoves(chessEngine.getLegalMoves(state, square));
        return;
      }

      // Deselect on same square click
      if (square === selected) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Attempt move
      if (legalMoves.includes(square)) {
        const move = buildMove(state, selected, square);
        const validation = chessEngine.validateMove(state, move);
        if (validation.valid) {
          const next = chessEngine.applyMove(state, move);
          onStateChange(next);
        }
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Clicked non-legal square — deselect
      setSelected(null);
      setLegalMoves([]);
    },
    [state, selected, legalMoves, onStateChange],
  );

  // Render ranks 8 → 1 (top to bottom = black side at top)
  const rankOrder = [...RANKS].reverse();

  return (
    <div className={styles.frame}>
      {/* Top coordinate row (file labels) */}
      <div className={styles.coordRowTop}>
        <div className={styles.coordCorner} />
        {FILES.map(f => (
          <div key={f} className={styles.coordLabel}>{f}</div>
        ))}
        <div className={styles.coordCorner} />
      </div>

      <div className={styles.middleRow}>
        {/* Left rank labels */}
        <div className={styles.coordCol}>
          {rankOrder.map(r => (
            <div key={r} className={styles.coordLabel}>{r}</div>
          ))}
        </div>

        {/* Board grid */}
        <div className={styles.board}>
          {rankOrder.map((rank, rankIdx) =>
            FILES.map((file, fileIdx) => {
              const square = `${file}${rank}` as Square;
              const piece = state.pieces.get(square);
              return (
                <SquareComponent
                  key={square}
                  square={square}
                  isLight={isLightSquare(fileIdx, 7 - rankIdx)}
                  piece={piece}
                  isSelected={selected === square}
                  isLegalTarget={legalMoves.includes(square)}
                  isInCheck={checkSquare === square}
                  isLastMove={square === lastFrom || square === lastTo}
                  onClick={handleSquareClick}
                />
              );
            }),
          )}
        </div>

        {/* Right rank labels */}
        <div className={styles.coordCol}>
          {rankOrder.map(r => (
            <div key={r} className={styles.coordLabel}>{r}</div>
          ))}
        </div>
      </div>

      {/* Bottom file labels */}
      <div className={styles.coordRowBottom}>
        <div className={styles.coordCorner} />
        {FILES.map(f => (
          <div key={f} className={styles.coordLabel}>{f}</div>
        ))}
        <div className={styles.coordCorner} />
      </div>
    </div>
  );
}
