import { useCallback, useState } from 'react';
import type { GameState, PieceType, Square } from '../../engine/types';
import { chessEngine } from '../../engine/ChessEngine';
import { buildMove } from '../../engine/gameLoop';
import { playCapture, playCastle, playMove } from '../../sound';
import { shouldForfeitTurnForGerald } from './interaction';
import SquareComponent from '../Square/Square';
import PromotionModal from '../PromotionModal/PromotionModal';
import styles from './Board.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const GERALD_ID = 'MOD-B002';
const WINTER_ID = 'MOD-A004';
const OBJECTOR_ID = 'MOD-B007';

interface BoardProps {
  state: GameState;
  onStateChange: (next: GameState) => void;
  onInfo?: (message: string) => void;
  showLegalMoves?: boolean;
  autoQueen?: boolean;
  showCoordinates?: boolean;
}

function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 !== 0;
}

function isFrozenZone(square: Square): boolean {
  const rank = square[1];
  return rank === '1' || rank === '2' || rank === '7' || rank === '8';
}

interface PendingPromotion {
  from: Square;
  to: Square;
}

function getDisplayLegalMoves(state: GameState, from: Square): Square[] {
  const legalMoves = chessEngine.getLegalMoves(state, from);
  return legalMoves.filter(to => {
    const move = buildMove(state, from, to);
    if (chessEngine.isPromotionMove(state, from, to)) {
      move.promotion = 'queen';
    }
    return chessEngine.validateMove(state, move).valid;
  });
}

export default function Board({
  state,
  onStateChange,
  onInfo,
  showLegalMoves = true,
  autoQueen = false,
  showCoordinates = true,
}: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const winterActive = state.activeModifiers.some(mod => mod.id === WINTER_ID);

  const lastMove = state.moveHistory[state.moveHistory.length - 1];
  const lastFrom = lastMove?.move.from;
  const lastTo   = lastMove?.move.to;

  // Find king square in check
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

  function sfxForMove(s: GameState, from: Square, to: Square, isCastle: boolean) {
    if (isCastle) { playCastle(); return; }
    if (s.pieces.has(to) || s.flags.enPassantSquare === to) { playCapture(); return; }
    playMove();
  }

  // Called when user picks a piece in the PromotionModal
  const handlePromotionChoice = useCallback(
    (type: PieceType) => {
      if (!pendingPromotion) return;
      const move = buildMove(state, pendingPromotion.from, pendingPromotion.to);
      move.promotion = type;
      const validation = chessEngine.validateMove(state, move);
      if (validation.valid) {
        playCapture(); // promotions often capture; use capture sfx
        onStateChange(chessEngine.applyMove(state, move));
      }
      setPendingPromotion(null);
      setSelected(null);
      setLegalMoves([]);
    },
    [pendingPromotion, state, onStateChange],
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (state.status !== 'active') return;
      if (pendingPromotion) return; // modal is open — ignore board clicks

      const clickedPiece = state.pieces.get(square);

      // Nothing selected yet
      if (!selected) {
        if (clickedPiece && clickedPiece.color === state.turn) {
          if (shouldForfeitTurnForGerald(clickedPiece, state.turn)) {
            onStateChange(chessEngine.passTurn(state));
            onInfo?.('Gerald chased off. Turn forfeited.');
            setSelected(null);
            setLegalMoves([]);
            return;
          }
          if ((clickedPiece.cooldowns[WINTER_ID] ?? 0) > 0) {
            onInfo?.('That piece is frozen this turn.');
          }
          if (clickedPiece.isPacifist) {
            onInfo?.('This piece refuses to capture.');
          }
          setSelected(square);
          setLegalMoves(getDisplayLegalMoves(state, square));
        }
        return;
      }

      // Re-select own piece
      if (clickedPiece && clickedPiece.color === state.turn && square !== selected) {
        if (shouldForfeitTurnForGerald(clickedPiece, state.turn)) {
          onStateChange(chessEngine.passTurn(state));
          onInfo?.('Gerald chased off. Turn forfeited.');
          setSelected(null);
          setLegalMoves([]);
          return;
        }
        if (clickedPiece.isPacifist) {
          onInfo?.('This piece refuses to capture.');
        }
        setSelected(square);
        setLegalMoves(getDisplayLegalMoves(state, square));
        return;
      }

      // Deselect same square
      if (square === selected) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Attempt move
      if (legalMoves.includes(square)) {
        // Promotion
        if (chessEngine.isPromotionMove(state, selected, square)) {
          if (autoQueen) {
            // Skip modal — auto-promote to queen
            const move = buildMove(state, selected, square);
            move.promotion = 'queen';
            const validation = chessEngine.validateMove(state, move);
            if (validation.valid) {
              sfxForMove(state, selected, square, false);
              onStateChange(chessEngine.applyMove(state, move));
            } else if (validation.reason) {
              onInfo?.(validation.reason);
            }
            setSelected(null);
            setLegalMoves([]);
          } else {
            setPendingPromotion({ from: selected, to: square });
          }
          return;
        }

        const move = buildMove(state, selected, square);
        const validation = chessEngine.validateMove(state, move);
        if (validation.valid) {
          sfxForMove(state, selected, square, !!move.isCastle);
          onStateChange(chessEngine.applyMove(state, move));
        } else if (validation.reason) {
          onInfo?.(validation.reason);
        }
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Clicked non-legal square — deselect
      setSelected(null);
      setLegalMoves([]);
    },
    [state, selected, legalMoves, pendingPromotion, onStateChange],
  );

  const rankOrder = [...RANKS].reverse();

  return (
    <>
      <div className={styles.frame}>
        {/* Top file labels */}
        {showCoordinates && (
          <div className={styles.coordRowTop}>
            <div className={styles.coordCorner} />
            {FILES.map(f => (
              <div key={f} className={styles.coordLabel}>{f}</div>
            ))}
            <div className={styles.coordCorner} />
          </div>
        )}

        <div className={styles.middleRow}>
          {/* Left rank labels */}
          {showCoordinates && (
            <div className={styles.coordCol}>
              {rankOrder.map(r => (
                <div key={r} className={styles.coordLabel}>{r}</div>
              ))}
            </div>
          )}

          {/* Board grid */}
          <div className={styles.board}>
            {rankOrder.map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}` as Square;
                const piece  = state.pieces.get(square);
                const tileEffects =
                  state.tiles.get(square)?.effects.map(effect => effect.type) ?? [];
                const frozenZone = winterActive && isFrozenZone(square);
                return (
                  <SquareComponent
                    key={square}
                    square={square}
                    isLight={isLightSquare(fileIdx, 7 - rankIdx)}
                    piece={piece}
                    isSelected={selected === square}
                    isLegalTarget={showLegalMoves && legalMoves.includes(square)}
                    isInCheck={checkSquare === square}
                    isLastMove={square === lastFrom || square === lastTo}
                    tileEffects={tileEffects}
                    isFrozenZone={frozenZone}
                    onClick={handleSquareClick}
                  />
                );
              }),
            )}
          </div>

          {/* Right rank labels */}
          {showCoordinates && (
            <div className={styles.coordCol}>
              {rankOrder.map(r => (
                <div key={r} className={styles.coordLabel}>{r}</div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom file labels */}
        {showCoordinates && (
          <div className={styles.coordRowBottom}>
            <div className={styles.coordCorner} />
            {FILES.map(f => (
              <div key={f} className={styles.coordLabel}>{f}</div>
            ))}
            <div className={styles.coordCorner} />
          </div>
        )}
      </div>

      {/* Promotion modal — rendered outside the board frame so it overlays everything */}
      {pendingPromotion && (
        <PromotionModal color={state.turn} onChoose={handlePromotionChoice} />
      )}
    </>
  );
}
