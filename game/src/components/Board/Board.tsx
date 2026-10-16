import { useCallback, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '@pigeon-chess/game-core';
import { chessEngine } from '@pigeon-chess/game-core';
import { buildMove } from '@pigeon-chess/game-core';
import { isFrozenZoneSquare } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { playCapture, playCastle, playMove } from '../../sound';
import { getMarkerLegend, shouldForfeitTurnForGerald } from './interaction';
import SquareComponent from '../Square/Square';
import PromotionModal from '../PromotionModal/PromotionModal';
import styles from './Board.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;

interface BoardProps {
  state: GameState;
  /** Local play: the board applies moves itself and reports the new state. */
  onStateChange?: (next: GameState) => void;
  /** Online play: the board only sends intents. The server applies them. */
  onMove?: (move: Move) => void;
  onShooGerald?: () => void;
  /** The side this player controls. Clicks are ignored on the other side's turn. */
  controlColor?: Color;
  /** Which side sits at the bottom. Black players see the board flipped. */
  orientation?: Color;
  onInfo?: (message: string) => void;
  showLegalMoves?: boolean;
  autoQueen?: boolean;
  showCoordinates?: boolean;
}

function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 !== 0;
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

function playSfxForMove(state: GameState, from: Square, to: Square, isCastle: boolean) {
  if (isCastle) {
    playCastle();
    return;
  }
  if (state.pieces.has(to) || state.flags.enPassantSquare === to) {
    playCapture();
    return;
  }
  playMove();
}

export default function Board({
  state,
  onStateChange,
  onMove,
  onShooGerald,
  controlColor,
  orientation = 'white',
  onInfo,
  showLegalMoves = true,
  autoQueen = false,
  showCoordinates = true,
}: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const commitMove = useCallback(
    (move: Move) => {
      if (onMove) onMove(move);
      else onStateChange?.(chessEngine.applyMove(state, move));
    },
    [onMove, onStateChange, state],
  );

  const winterActive = state.activeModifiers.some(mod => mod.id === WINTER_ID);
  const markerLegend = getMarkerLegend(state.activeModifiers.map(mod => mod.id));

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

  // Called when user picks a piece in the PromotionModal
  const handlePromotionChoice = useCallback(
    (type: PieceType) => {
      if (!pendingPromotion) return;
      const move = buildMove(state, pendingPromotion.from, pendingPromotion.to);
      move.promotion = type;
      const validation = chessEngine.validateMove(state, move);
      if (validation.valid) {
        playSfxForMove(state, pendingPromotion.from, pendingPromotion.to, false);
        commitMove(move);
      }
      setPendingPromotion(null);
      setSelected(null);
      setLegalMoves([]);
    },
    [commitMove, pendingPromotion, state],
  );

  const shooGeraldOrWarn = useCallback(() => {
    setSelected(null);
    setLegalMoves([]);
    if (!chessEngine.canShooGerald(state)) {
      onInfo?.('You are in check. Gerald stays put.');
      return;
    }
    if (onShooGerald) onShooGerald();
    else onStateChange?.(chessEngine.shooGerald(state));
    onInfo?.('Gerald chased off. Turn forfeited.');
  }, [state, onStateChange, onShooGerald, onInfo]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (state.status !== 'active') return;
      if (controlColor && state.turn !== controlColor) return; // opponent's turn
      if (pendingPromotion) return; // modal is open — ignore board clicks

      const clickedPiece = state.pieces.get(square);

      // Nothing selected yet
      if (!selected) {
        if (clickedPiece && clickedPiece.color === state.turn) {
          if (shouldForfeitTurnForGerald(clickedPiece, state.turn)) {
            shooGeraldOrWarn();
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
          shooGeraldOrWarn();
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
              playSfxForMove(state, selected, square, false);
              commitMove(move);
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
          playSfxForMove(state, selected, square, !!move.isCastle);
          commitMove(move);
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
    [autoQueen, commitMove, controlColor, legalMoves, onInfo, pendingPromotion, selected, shooGeraldOrWarn, state],
  );

  const rankOrder = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const fileOrder = orientation === 'white' ? [...FILES] : [...FILES].reverse();

  return (
    <>
      <div className={markerLegend.length > 0 ? `${styles.frame} ${styles.withLegend}` : styles.frame}>
        {/* Top file labels */}
        {showCoordinates && (
          <div className={styles.coordRowTop}>
            <div className={styles.coordCorner} />
            {fileOrder.map(f => (
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
            {rankOrder.map(rank =>
              fileOrder.map(file => {
                const square = `${file}${rank}` as Square;
                const piece  = state.pieces.get(square);
                const tileEffects =
                  state.tiles.get(square)?.effects.map(effect => effect.type) ?? [];
                const frozenZone = winterActive && isFrozenZoneSquare(square);
                const swamp = state.tiles.get(square)?.isSwamp === true;
                return (
                  <SquareComponent
                    key={square}
                    square={square}
                    isLight={isLightSquare(FILES.indexOf(file), RANKS.indexOf(rank))}
                    piece={piece}
                    isSelected={selected === square}
                    isLegalTarget={showLegalMoves && legalMoves.includes(square)}
                    isInCheck={checkSquare === square}
                    isLastMove={square === lastFrom || square === lastTo}
                    tileEffects={tileEffects}
                    isFrozenZone={frozenZone}
                    isSwamp={swamp}
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
            {fileOrder.map(f => (
              <div key={f} className={styles.coordLabel}>{f}</div>
            ))}
            <div className={styles.coordCorner} />
          </div>
        )}

        {markerLegend.length > 0 && (
          <div className={styles.legend} aria-label="Board markers">
            {markerLegend.map(entry => (
              <span key={entry.label} className={styles.legendItem}>
                <span className={styles.legendMark}>{entry.mark}</span>
                {entry.label}
              </span>
            ))}
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
