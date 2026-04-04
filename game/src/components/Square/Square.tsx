import { useRef, useState } from 'react';
import type { Piece as PieceType, Square as SquareType, TileEffectType } from '../../engine/types';
import PieceComponent from '../Piece/Piece';
import styles from './Square.module.css';

interface SquareProps {
  square: SquareType;
  isLight: boolean;
  piece: PieceType | undefined;
  isSelected: boolean;
  isLegalTarget: boolean;
  isInCheck: boolean;
  isLastMove: boolean;
  tileEffects: TileEffectType[];
  isFrozenZone: boolean;
  onClick: (square: SquareType) => void;
}

const GERALD_ID = 'MOD-B002';
const WINTER_ID = 'MOD-A004';

function getPieceTooltipLines(piece: PieceType | undefined): string[] {
  if (!piece) return [];

  const lines: string[] = [];

  if ((piece.cooldowns[GERALD_ID] ?? 0) > 0) {
    lines.push('Gerald: This piece is blocked and clearing it costs the turn.');
  }
  if ((piece.cooldowns[WINTER_ID] ?? 0) > 0) {
    lines.push('Winter Is Coming: This piece is frozen for one turn.');
  }
  if (piece.isPacifist) {
    lines.push('Conscientious Objector: This piece refuses to capture.');
  }
  if (piece.isBerserker) {
    lines.push('Berserker: This piece chain-captures when another capture exists.');
  }

  return lines;
}

function getTileTooltipLines(
  tileEffects: TileEffectType[],
  isFrozenZone: boolean,
): string[] {
  const lines: string[] = [];

  if (tileEffects.includes('lava')) {
    lines.push('Floor Is Lava: Non-king pieces landing here are destroyed.');
  }
  if (isFrozenZone) {
    lines.push('Winter Is Coming: Pieces entering this zone must thaw before moving again.');
  }

  return lines;
}

export default function Square({
  square,
  isLight,
  piece,
  isSelected,
  isLegalTarget,
  isInCheck,
  isLastMove,
  tileEffects,
  isFrozenZone,
  onClick,
}: SquareProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const colorClass = isLight ? styles.light : styles.dark;
  const hasLava = tileEffects.includes('lava');
  const pieceTooltipLines = getPieceTooltipLines(piece);
  const tileTooltipLines = getTileTooltipLines(tileEffects, isFrozenZone);
  const tooltipLines = [...pieceTooltipLines, ...tileTooltipLines];
  const hasTooltip = tooltipLines.length > 0;

  const overlayClass = isInCheck
    ? styles.check
    : isSelected
      ? styles.selected
      : isLastMove
        ? styles.lastMove
        : '';

  function clearTouchTimer() {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  function handleTouchStart() {
    if (!hasTooltip) return;
    clearTouchTimer();
    longPressTriggeredRef.current = false;
    touchTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowTooltip(true);
    }, 450);
  }

  function handleTouchEnd() {
    clearTouchTimer();
  }

  function handleClick() {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onClick(square);
  }

  return (
    <div
      className={`${styles.square} ${colorClass} ${overlayClass}`}
      onClick={handleClick}
      onMouseEnter={() => hasTooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        clearTouchTimer();
        setShowTooltip(false);
      }}
      data-square={square}
      role="button"
      aria-label={tooltipLines.length > 0 ? `${square}, ${tooltipLines.join(' ')}` : square}
      tabIndex={-1}
    >
      {isFrozenZone && (
        <div className={styles.tileEffectLayer} aria-hidden="true">
          <div className={styles.frozenGlow} />
          <div className={styles.frozenIcon}>❄</div>
        </div>
      )}

      {hasLava && (
        <div className={styles.tileEffectLayer} aria-hidden="true">
          <div className={styles.lavaGlow} />
          <div className={styles.lavaIcon}>▲</div>
        </div>
      )}

      {piece && (
        <div className={styles.pieceLayer}>
          <PieceComponent piece={piece} />
        </div>
      )}

      {isLegalTarget && (
        <div className={piece ? styles.captureDot : styles.legalDot} />
      )}

      {hasTooltip && showTooltip && (
        <div className={styles.tooltip} role="tooltip">
          {tooltipLines.map(line => (
            <div key={line} className={styles.tooltipLine}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
