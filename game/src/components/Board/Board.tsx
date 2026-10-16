import { useCallback, useEffect, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '@pigeon-chess/game-core';
import { chessEngine } from '@pigeon-chess/game-core';
import { buildMove } from '@pigeon-chess/game-core';
import { getAbilityOptions, getValidPromotionTypes, isFrozenZoneSquare, modifierRegistry } from '@pigeon-chess/game-core';
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
    if (chessEngine.isPromotionMove(state, from, to)) {
      return getValidPromotionTypes(state, from, to).length > 0;
    }
    return chessEngine.validateMove(state, buildMove(state, from, to)).valid;
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
  /** The ability (modifier id) armed for the selected piece, if any. */
  const [abilityMode, setAbilityMode] = useState<string | null>(null);

  // A new selection (or none) always disarms the ability.
  useEffect(() => setAbilityMode(null), [selected, state]);

  // MOD-B001: flash "A PIECE MOVED" when a piece moved on its own.
  const [pieceMovedFlash, setPieceMovedFlash] = useState(false);
  const plies = state.moveHistory.length;
  const pieceMovedNow = state.eventHistory.some(
    event => event.modifierId === MODIFIER_IDS.youDied && event.ply === plies,
  );
  useEffect(() => {
    if (!pieceMovedNow) return;
    setPieceMovedFlash(true);
    const timer = window.setTimeout(() => setPieceMovedFlash(false), 1400);
    return () => window.clearTimeout(timer);
  }, [plies, pieceMovedNow]);

  const abilitySide = controlColor ?? state.turn;
  const hasAbilityCards = state.activeModifiers.some(
    mod => modifierRegistry.get(mod.id)?.ability && (mod.sourceColor == null || mod.sourceColor === abilitySide),
  );
  const abilityOptions = selected && state.pieces.get(selected)?.color === abilitySide
    ? getAbilityOptions(state, selected)
    : [];

  const toggleAbility = useCallback(
    (modifierId: string) => {
      if (!selected) return;
      if (abilityMode === modifierId) {
        setAbilityMode(null);
        setLegalMoves(getDisplayLegalMoves(state, selected));
        return;
      }
      const option = getAbilityOptions(state, selected).find(o => o.modifierId === modifierId);
      if (!option || option.targets.length === 0) return;
      setAbilityMode(modifierId);
      setLegalMoves(option.targets);
    },
    [abilityMode, selected, state],
  );
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

      // Attempt an armed ability (it may target an own piece, so check first)
      if (abilityMode && legalMoves.includes(square)) {
        const move: Move = { from: selected, to: square, playerColor: state.turn, ability: abilityMode };
        const validation = chessEngine.validateMove(state, move);
        if (validation.valid) {
          if (state.pieces.has(square)) playCapture();
          else playMove();
          commitMove(move);
        } else if (validation.reason) {
          onInfo?.(validation.reason);
        }
        setSelected(null);
        setLegalMoves([]);
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
            // Skip modal: promote to the best piece the modifiers allow
            const move = buildMove(state, selected, square);
            move.promotion = getValidPromotionTypes(state, selected, square)[0] ?? 'queen';
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
    [abilityMode, autoQueen, commitMove, controlColor, legalMoves, onInfo, pendingPromotion, selected, shooGeraldOrWarn, state],
  );

  const rankOrder = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const fileOrder = orientation === 'white' ? [...FILES] : [...FILES].reverse();

  return (
    <>
      <div className={[styles.frame, markerLegend.length > 0 ? styles.withLegend : '', hasAbilityCards ? styles.withAbilities : ''].filter(Boolean).join(' ')}>
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
            {pieceMovedFlash && (
              <div className={styles.pieceMovedFlash} role="status">A PIECE MOVED</div>
            )}
            {rankOrder.map(rank =>
              fileOrder.map(file => {
                const square = `${file}${rank}` as Square;
                const piece  = state.pieces.get(square);
                const tileEffects =
                  state.tiles.get(square)?.effects.map(effect => effect.type) ?? [];
                const frozenZone = winterActive && isFrozenZoneSquare(square);
                const swamp = state.tiles.get(square)?.isSwamp === true;
                const shaft = state.tiles.get(square)?.isVoid === true;
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
                    isShaft={shaft}
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

        {hasAbilityCards && (
          <div className={styles.abilityBar} aria-label="Abilities">
            {abilityOptions.length === 0 ? (
              <span className={styles.abilityHint}>
                {selected ? 'This piece has no ability.' : 'Select a piece to see its ability.'}
              </span>
            ) : (
              abilityOptions.map(option => {
                const ready = option.cooldownLeft === 0 && option.targets.length > 0;
                const armed = abilityMode === option.modifierId;
                return (
                  <button
                    key={option.modifierId}
                    type="button"
                    className={`${styles.abilityButton} ${armed ? styles.abilityArmed : ''}`}
                    disabled={!ready}
                    aria-pressed={armed}
                    title={option.hint}
                    onClick={() => toggleAbility(option.modifierId)}
                  >
                    {armed ? `Cancel ${option.label}` : option.label}
                    <span className={styles.abilityState}>
                      {option.cooldownLeft > 0
                        ? `ready in ${option.cooldownLeft}`
                        : option.targets.length === 0
                          ? 'no target'
                          : armed
                            ? 'pick a target'
                            : 'ready'}
                    </span>
                  </button>
                );
              })
            )}
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
        <PromotionModal
          color={state.turn}
          allowed={getValidPromotionTypes(state, pendingPromotion.from, pendingPromotion.to)}
          onChoose={handlePromotionChoice}
        />
      )}
    </>
  );
}
