import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '@pigeon-chess/game-core';
import { chessEngine } from '@pigeon-chess/game-core';
import { buildMove, needsSpoilerMark, canCtrlZ, ctrlZ, ctrlZBlocker, getShooBlocker, getTouchedPiece, hasTouchMove, touchPiece, touchedReason, isHiddenPieceMove } from '@pigeon-chess/game-core';
import {
  flipSquare,
  flippedMovesLeft,
  getFakeMoveHints,
  getAbilityChoices,
  getAbilityOptions,
  getValidPromotionTypes,
  isHistoryBlackout,
  modifierRegistry,
} from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { playCapture, playCastle, playMove } from '../../sound';
import { SPRITES } from '../../characters';
import { getMarkerLegend, shouldForfeitTurnForGerald, viewerModifierIds } from './interaction';
import SquareComponent from '../Square/Square';
import { buildSquareViews, type SquareBurst } from './boardView';

// Phaser is large, so it loads in its own chunk once a game starts.
const PhaserBoard = lazy(() => import('../PhaserBoard/PhaserBoard'));
import PromotionModal from '../PromotionModal/PromotionModal';
import styles from './Board.module.css';
import { ModifierIcon } from '../ModifierIcon/ModifierIcon';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;
const FREAKY_FRIDAY_ID = MODIFIER_IDS.freakyFriday;
const BURST_KINDS: Partial<Record<string, SquareBurst['kind']>> = {
  [MODIFIER_IDS.floorIsLava]: 'lava',
  [MODIFIER_IDS.berserker]: 'berserker',
  [MODIFIER_IDS.stormClosesIn]: 'storm',
  [MODIFIER_IDS.cordycepticSpread]: 'infection',
};

interface BoardProps {
  state: GameState;
  /** Local play: the board applies moves itself and reports the new state. */
  onStateChange?: (next: GameState) => void;
  /** The board only sends intents: online the server applies them, in bot games App applies and saves them. */
  onMove?: (move: Move) => void;
  onShooGerald?: () => void;
  /** Online play: MOD-B015 sends the touched piece to the server. Local play applies it here. */
  onTouchPiece?: (square: Square) => void;
  /** MOD-C015: online and in bot games the undo is sent out. Local play applies it here. */
  onUndo?: () => void;
  /** The side this player controls. Clicks are ignored on the other side's turn. */
  controlColor?: Color;
  /** Which side sits at the bottom. Black players see the board flipped. */
  orientation?: Color;
  onInfo?: (message: string) => void;
  /** A short message shown over the top of the board (why a click did nothing, event banners). */
  notice?: string | null;
  showLegalMoves?: boolean;
  autoQueen?: boolean;
  showCoordinates?: boolean;
  /** Told when a popup on the board (promotion or drop choice) opens or closes. */
  onPopupChange?: (open: boolean) => void;
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

/** Plain-chess refusals. Only a card's own reason is worth showing on select. */
const ENGINE_REASONS = new Set([
  'leaves king in check',
  'illegal move for piece type',
  'cannot castle while in check',
  'cannot castle through check',
  'blocked by modifier',
]);

function playSfxForMove(state: GameState, from: Square, to: Square, isCastle: boolean) {
  if (isCastle) {
    playCastle();
    return;
  }
  // A sideways pawn step (MOD-E014) onto the en passant square is not a capture.
  const enPassant = state.flags.enPassantSquare === to && from[1] !== to[1];
  if (state.pieces.has(to) || enPassant) {
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
  onTouchPiece,
  onUndo,
  controlColor,
  orientation = 'white',
  onInfo,
  notice = null,
  showLegalMoves = true,
  autoQueen = false,
  showCoordinates = true,
  onPopupChange,
}: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  /** MOD-D007: fake dots mixed into legalMoves. */
  const [fakeMoves, setFakeMoves] = useState<Square[]>([]);
  /** Bumps on each fake dot picked, so the RECALCULATING banner replays. */
  const [recalcKey, setRecalcKey] = useState(0);
  useEffect(() => {
    if (recalcKey === 0) return;
    const timer = window.setTimeout(() => setRecalcKey(0), 1100);
    return () => window.clearTimeout(timer);
  }, [recalcKey]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  /** MOD-E008: an armed drop waiting for the player to pick which piece. */
  const [pendingDrop, setPendingDrop] = useState<{ move: Move; choices: PieceType[] } | null>(null);
  /** MOD-D019 Spoiler Alert: a chosen move waiting for the player to mark their next piece. */
  const [pendingSpoiler, setPendingSpoiler] = useState<{ move: Move; preview: GameState } | null>(null);
  // The Spoiler Alert step is not a popup: it must not pause the Speedrun clock.
  const boardPopupOpen = pendingPromotion !== null || pendingDrop !== null;
  useEffect(() => {
    onPopupChange?.(boardPopupOpen);
  }, [boardPopupOpen, onPopupChange]);
  /** The ability (modifier id) armed for the selected piece, if any. */
  const [abilityMode, setAbilityMode] = useState<string | null>(null);

  // A new selection (or none) always disarms the ability.
  // Keyed on the move count, not the state object: a touch (MOD-B015) makes a new state mid-turn.
  const movesPlayed = state.moveHistory.length;
  useEffect(() => setAbilityMode(null), [selected, movesPlayed, state.turn]);
  /** MOD-C007: the next normal move spends a tempo token and keeps the turn. */
  const [extraMode, setExtraMode] = useState(false);
  useEffect(() => setExtraMode(false), [movesPlayed, state.turn]);

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

  // GDD UI: flash the squares where a modifier just struck (lava burns, berserker chains, storm waves).
  const bursts = useMemo(() => {
    const map = new Map<Square, SquareBurst>();
    for (const event of state.eventHistory) {
      if (event.ply !== plies || !event.squares) continue;
      const kind = BURST_KINDS[event.modifierId] ?? 'event';
      for (const sq of event.squares) map.set(sq, { key: event.id, kind });
    }
    return map;
  }, [state.eventHistory, plies]);

  const abilitySide = controlColor ?? state.turn;
  const tempoTokens = state.tempoTokens[abilitySide] ?? 0;
  // MOD-C015 Ctrl+Z: a once-per-match button, shown with the abilities.
  const ownsCtrlZ = state.activeModifiers.some(
    mod => mod.id === MODIFIER_IDS.ctrlZ && (mod.sourceColor == null || mod.sourceColor === abilitySide),
  );
  const ctrlZUsed = ownsCtrlZ && !!(state.modifierState[MODIFIER_IDS.ctrlZ] as Partial<Record<string, { used?: boolean }>> | undefined)?.[abilitySide]?.used;
  const ctrlZReady = ownsCtrlZ && state.turn === abilitySide && canCtrlZ(state);
  const [undoArmed, setUndoArmed] = useState(false);
  useEffect(() => setUndoArmed(false), [state]);
  const hasPieceAbilities = state.activeModifiers.some(
    mod => modifierRegistry.get(mod.id)?.ability && (mod.sourceColor == null || mod.sourceColor === abilitySide),
  );
  const hasAbilityCards = ownsCtrlZ || state.activeModifiers.some(
    mod => modifierRegistry.get(mod.id)?.ability && (mod.sourceColor == null || mod.sourceColor === abilitySide),
  );
  const abilityOptions = selected && state.pieces.get(selected)?.color === abilitySide
    ? getAbilityOptions(state, selected)
    : [];

  // MOD-B003: the cursed side clicks the square across the board's centre.
  const flip = state.status === 'active' && flippedMovesLeft(state, state.turn) > 0;
  const onScreen = useCallback(
    (squares: Square[]) => (flip ? squares.map(flipSquare) : squares),
    [flip],
  );

  const showMovesFor = useCallback(
    (square: Square, explain = true) => {
      const real = getDisplayLegalMoves(state, square);
      const fakes = getFakeMoveHints(state, square, real);
      // A card can leave a piece with no moves (such as Peer Pressure). Say why,
      // unless Recalculating is drawing fake dots that the message would give away.
      if (explain && real.length === 0 && fakes.length === 0) {
        const blocked = chessEngine.getLegalMoves(state, square)
          .map(to => chessEngine.validateMove(state, buildMove(state, square, to)).reason)
          .find(reason => reason && !ENGINE_REASONS.has(reason));
        if (blocked) onInfo?.(blocked);
      }
      setFakeMoves(onScreen(fakes));
      setLegalMoves(onScreen([...real, ...fakes]));
    },
    [onInfo, onScreen, state],
  );

  const toggleAbility = useCallback(
    (modifierId: string) => {
      if (!selected) return;
      if (abilityMode === modifierId) {
        setAbilityMode(null);
        showMovesFor(selected, false);
        return;
      }
      const option = getAbilityOptions(state, selected).find(o => o.modifierId === modifierId);
      if (!option || option.targets.length === 0) return;
      setAbilityMode(modifierId);
      setFakeMoves([]);
      setLegalMoves(onScreen(option.targets));
    },
    [abilityMode, onScreen, selected, showMovesFor, state],
  );
  const withTempo = useCallback(
    (move: Move): Move => (extraMode ? { ...move, extraTurn: true } : move),
    [extraMode],
  );
  const sendMove = useCallback(
    (move: Move) => {
      if (onMove) onMove(move);
      else onStateChange?.(chessEngine.applyMove(state, move));
    },
    [onMove, onStateChange, state],
  );
  const commitMove = useCallback(
    (move: Move) => {
      // MOD-D019: first mark the piece you will move next. The preview only moves the
      // chosen piece, so it never shows a hidden or random result (mines, bumps).
      if (move.spoiler === undefined && needsSpoilerMark(state, move)) {
        const pieces = new Map(state.pieces);
        const mover = pieces.get(move.from);
        const entersTarget = !move.ability || modifierRegistry.get(move.ability)?.ability?.entersTarget !== false;
        if (mover && entersTarget && move.from !== move.to) {
          pieces.delete(move.from);
          pieces.set(move.to, { ...mover, square: move.to });
        }
        const marks = { ...(state.modifierState[MODIFIER_IDS.spoilerAlert] as Record<string, string> | undefined) };
        delete marks[move.playerColor];
        setPendingSpoiler({ move, preview: { ...state, pieces, modifierState: { ...state.modifierState, [MODIFIER_IDS.spoilerAlert]: marks } } });
        return;
      }
      sendMove(move);
    },
    [sendMove, state],
  );
  useEffect(() => setPendingSpoiler(null), [movesPlayed, state.turn]);
  /** Only pieces already on the board can be marked (not a piece the move places). */
  const spoilerIds = useMemo(() => new Set([...state.pieces.values()].map(p => p.id)), [state.pieces]);

  // MOD-B005: during a blackout the cursed side does not see the last move either.
  const forgetsLastMove = isHistoryBlackout(state, controlColor ?? state.turn);
  const latest = state.moveHistory[state.moveHistory.length - 1];
  // Hidden pieces: a move by a piece the viewer cannot see leaves no highlight.
  const lastMove = forgetsLastMove || (latest && isHiddenPieceMove(state, latest, controlColor ?? state.turn)) ? undefined : latest;
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
      const move = withTempo(buildMove(state, pendingPromotion.from, pendingPromotion.to));
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
    [commitMove, pendingPromotion, state, withTempo],
  );

  const handleDropChoice = useCallback(
    (type: PieceType | null) => {
      if (pendingDrop && type) {
        const move = { ...pendingDrop.move, dropType: type };
        if (chessEngine.validateMove(state, move).valid) {
          playMove();
          commitMove(move);
        }
      }
      setPendingDrop(null);
      setSelected(null);
      setLegalMoves([]);
    },
    [commitMove, pendingDrop, state],
  );

  const shooGeraldOrWarn = useCallback(() => {
    setSelected(null);
    setLegalMoves([]);
    if (!chessEngine.canShooGerald(state)) {
      onInfo?.(getShooBlocker(state) ?? 'Gerald stays put.');
      return;
    }
    if (onShooGerald) onShooGerald();
    else onStateChange?.(chessEngine.shooGerald(state));
    onInfo?.('Gerald chased off. Turn forfeited.');
  }, [state, onStateChange, onShooGerald, onInfo]);

  // MOD-B015 Commitment Issues: a tap on an own piece touches it, and a touched piece must move.
  const touchMove = state.status === 'active' && hasTouchMove(state, state.turn) && (!controlColor || controlColor === state.turn);
  const touched = touchMove ? getTouchedPiece(state, state.turn) : null;
  const touchedSquare = touched?.square ?? null;
  const touch = useCallback(
    (square: Square) => {
      if (!touchMove || touchedSquare) return;
      if (onTouchPiece) {
        onTouchPiece(square);
        return;
      }
      const next = touchPiece(state, square);
      if (next !== state) onStateChange?.(next);
    },
    [onStateChange, onTouchPiece, state, touchMove, touchedSquare],
  );
  // Keep the touched piece selected, also after a reload or a refused move.
  useEffect(() => {
    if (!touchedSquare || selected === touchedSquare) return;
    setSelected(touchedSquare);
    showMovesFor(touchedSquare, false);
  }, [touchedSquare, selected, showMovesFor]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (state.status !== 'active') return;
      if (controlColor && state.turn !== controlColor) return; // opponent's turn
      if (pendingSpoiler) {
        const marked = pendingSpoiler.preview.pieces.get(square);
        if (marked && marked.color === pendingSpoiler.move.playerColor && spoilerIds.has(marked.id)) {
          setPendingSpoiler(null);
          sendMove({ ...pendingSpoiler.move, spoiler: marked.id });
        }
        return;
      }
      if (pendingPromotion || pendingDrop) return; // modal is open — ignore board clicks

      const clickedPiece = state.pieces.get(square);

      // MOD-B015: once a piece is touched, only its own moves (or abilities) go through.
      if (touched && !(selected === touched.square && legalMoves.includes(square))) {
        if (square !== touched.square && clickedPiece?.color === state.turn) onInfo?.(touchedReason(touched));
        return;
      }

      // Nothing selected yet
      if (!selected) {
        if (clickedPiece && clickedPiece.color === state.turn) {
          if (shouldForfeitTurnForGerald(clickedPiece, state.turn)) {
            shooGeraldOrWarn();
            return;
          }
          const frozen = (clickedPiece.cooldowns[WINTER_ID] ?? 0) > 0;
          if (frozen) {
            onInfo?.('That piece is frozen this turn.');
          }
          if (clickedPiece.isPacifist) {
            onInfo?.('This piece refuses to capture.');
          }
          setSelected(square);
          showMovesFor(square, !frozen && !clickedPiece.isPacifist);
          touch(square);
        }
        return;
      }

      // MOD-B003: a highlighted square stands for the square across the centre.
      const isTarget = legalMoves.includes(square);
      const to = flip ? flipSquare(square) : square;

      // Attempt an armed ability (it may target an own piece, so check first)
      if (abilityMode && isTarget) {
        const move: Move = { from: selected, to, playerColor: state.turn, ability: abilityMode };
        const choices = getAbilityChoices(state, selected, to, abilityMode);
        if (choices && choices.length > 1) {
          setPendingDrop({ move, choices });
          return;
        }
        if (choices?.length === 1) move.dropType = choices[0];
        const validation = chessEngine.validateMove(state, move);
        if (validation.valid) {
          // A swap (MOD-C012) targets an own piece and captures nothing.
          // An ability on the piece's own square (MOD-C017) captures nothing either.
          if (state.pieces.has(to) && to !== selected && abilityMode !== FREAKY_FRIDAY_ID) playCapture();
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
      if (clickedPiece && clickedPiece.color === state.turn && square !== selected && !(flip && isTarget)) {
        if (shouldForfeitTurnForGerald(clickedPiece, state.turn)) {
          shooGeraldOrWarn();
          return;
        }
        if (clickedPiece.isPacifist) {
          onInfo?.('This piece refuses to capture.');
        }
        setSelected(square);
        showMovesFor(square, !clickedPiece.isPacifist);
        touch(square);
        return;
      }

      // Deselect same square
      if (square === selected && !(flip && isTarget)) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // MOD-D007: a fake dot. The player picks again, no move lost.
      if (fakeMoves.includes(square)) {
        setRecalcKey(key => key + 1);
        setFakeMoves(fakes => fakes.filter(sq => sq !== square));
        setLegalMoves(moves => moves.filter(sq => sq !== square));
        return;
      }

      // Attempt move
      if (isTarget) {
        // Promotion
        if (chessEngine.isPromotionMove(state, selected, to)) {
          if (autoQueen) {
            // Skip modal: promote to the best piece the modifiers allow
            const move = withTempo(buildMove(state, selected, to));
            move.promotion = getValidPromotionTypes(state, selected, to)[0] ?? 'queen';
            const validation = chessEngine.validateMove(state, move);
            if (validation.valid) {
              playSfxForMove(state, selected, to, false);
              commitMove(move);
            } else if (validation.reason) {
              onInfo?.(validation.reason);
            }
            setSelected(null);
            setLegalMoves([]);
          } else {
            setPendingPromotion({ from: selected, to });
          }
          return;
        }

        const move = withTempo(buildMove(state, selected, to));
        const validation = chessEngine.validateMove(state, move);
        if (validation.valid) {
          playSfxForMove(state, selected, to, !!move.isCastle);
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
    [abilityMode, autoQueen, commitMove, controlColor, pendingSpoiler, sendMove, spoilerIds, fakeMoves, flip, legalMoves, onInfo, pendingDrop, pendingPromotion, selected, shooGeraldOrWarn, showMovesFor, state, touch, touched, withTempo],
  );

  const rankOrder = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const fileOrder = orientation === 'white' ? [...FILES] : [...FILES].reverse();
  const spoilerChoices = pendingSpoiler
    ? [...pendingSpoiler.preview.pieces.values()].filter(p => p.color === pendingSpoiler.move.playerColor && spoilerIds.has(p.id)).map(p => p.square)
    : null;
  const squareViews = buildSquareViews({
    state: pendingSpoiler?.preview ?? state,
    orientation,
    selected: pendingSpoiler ? null : selected,
    legalMoves: spoilerChoices ?? legalMoves,
    showLegalMoves: showLegalMoves || spoilerChoices !== null,
    checkSquare,
    lastFrom,
    lastTo,
    bursts,
    viewer: controlColor ?? state.turn,
  });
  const activeIds = state.activeModifiers.map(mod => mod.id);
  // Only what this player can see, so fog never gives away a hidden Egg.
  const markerLegend = getMarkerLegend(activeIds, {
    eggOnBoard: squareViews.some(view => view.piece?.type === 'egg'),
    flippedMovesLeft: flippedMovesLeft(state, controlColor ?? state.turn),
    touchScreen: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true,
    viewerModifierIds: viewerModifierIds(state, controlColor ?? state.turn),
  });
  // The layout follows the cards in play, not the rows showing now, so the
  // board keeps one size for the whole match.
  const hasLegend = getMarkerLegend(activeIds).length > 0;

  return (
    <>
      <div className={['pc-board', 'on-dark', styles.frame, hasLegend ? styles.withLegend : '', hasAbilityCards ? styles.withAbilities : ''].filter(Boolean).join(' ')}>
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
            {notice && (
              <div key={notice} className={styles.notice} role="status">{notice}</div>
            )}
            {recalcKey > 0 && (
              <div key={recalcKey} className={styles.recalcFlash} role="status">RECALCULATING…</div>
            )}
            {pendingSpoiler && (
              <div className={styles.spoilerBar} role="status">
                <span>Spoiler Alert: tap the piece you will move next.</span>
                <button type="button" className={styles.spoilerCancel} onClick={() => setPendingSpoiler(null)}>Cancel</button>
              </div>
            )}
            {pieceMovedFlash && (
              <div className={styles.pieceMovedFlash} role="status">A PIECE MOVED</div>
            )}
            <Suspense fallback={null}>
              <PhaserBoard views={squareViews} />
            </Suspense>
            {squareViews.map(view => (
              <SquareComponent
                key={view.square}
                {...view}
                holdNeverTaps={touchMove && state.pieces.get(view.square)?.color === state.turn}
                onClick={handleSquareClick}
              />
            ))}
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
            {tempoTokens > 0 && (
              <button
                type="button"
                className={`${styles.abilityButton} ${extraMode ? styles.abilityArmed : ''}`}
                disabled={state.turn !== abilitySide}
                aria-pressed={extraMode}
                title="Spend a tempo token: your next move does not end your turn. It cannot give check."
                onClick={() => setExtraMode(on => !on)}
              >
                {extraMode ? 'Cancel extra move' : 'Extra move'}
                <span className={styles.abilityState}>
                  {extraMode ? 'make your move' : `${tempoTokens} token${tempoTokens === 1 ? '' : 's'}`}
                </span>
              </button>
            )}
            {ownsCtrlZ && (
              <button
                type="button"
                className={`${styles.abilityButton} ${undoArmed ? styles.abilityArmed : ''}`}
                disabled={!ctrlZReady}
                aria-pressed={undoArmed}
                title="Once per match: undo the last round (your last move and the reply), then move again."
                onClick={() => {
                  if (!undoArmed) {
                    setUndoArmed(true);
                    return;
                  }
                  setUndoArmed(false);
                  if (onUndo) onUndo();
                  else onStateChange?.(ctrlZ(state));
                }}
              >
                <ModifierIcon id={MODIFIER_IDS.ctrlZ} size={20} className={styles.abilityIcon} />
                {undoArmed ? 'Tap again to undo' : 'Ctrl+Z'}
                <span className={styles.abilityState}>
                  {ctrlZUsed
                    ? 'used'
                    : ctrlZReady
                      ? undoArmed ? 'last round goes back' : 'once per match'
                      : state.turn === abilitySide ? (ctrlZBlocker(state) ?? '').replace(/^Nothing to undo yet: /, '') : 'on your turn'}
                </span>
              </button>
            )}
            {abilityOptions.length === 0 ? (!hasPieceAbilities && !tempoTokens ? null : (
              <span className={styles.abilityHint}>
                {selected ? 'This piece has no ability.' : 'Select a piece to see its ability.'}
              </span>
            )) : (
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
                    <ModifierIcon id={option.modifierId} size={20} className={styles.abilityIcon} />
                    {armed ? `Cancel ${option.label}` : option.label}
                    <span className={styles.abilityState}>
                      {option.cooldownLeft > 0
                        ? `ready in ${option.cooldownLeft}`
                        : option.targets.length === 0
                          ? option.status ?? 'no target'
                          : armed
                            ? 'pick a target'
                            : option.status ?? 'ready'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {hasLegend && (
          <div className={styles.legend} aria-label="Board markers">
            {markerLegend.map(entry => (
              <span key={entry.label} className={styles.legendItem}>
                {entry.mark === 'G' ? (
                  <img src={SPRITES.gerald} alt="" className={styles.legendSprite} />
                ) : (
                  <span className={styles.legendMark}>{entry.mark}</span>
                )}
                {entry.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Promotion modal — rendered outside the board frame so it overlays everything */}
      {pendingDrop && (
        <PromotionModal
          color={state.turn}
          heading="Buy Back"
          allowed={pendingDrop.choices}
          onChoose={handleDropChoice}
          onCancel={() => handleDropChoice(null)}
        />
      )}

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
