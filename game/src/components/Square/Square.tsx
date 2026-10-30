import { useRef, useState } from 'react';
import type { Piece as PieceType, Square as SquareType, TileEffectType } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import PieceComponent from '../Piece/Piece';
import styles from './Square.module.css';

/** A one-off flash on a square where a modifier just struck. */
export interface SquareBurst {
  /** Changes for each new event, so the animation replays. */
  key: string;
  kind: 'lava' | 'berserker' | 'event';
}

const BURST_CLASS: Record<SquareBurst['kind'], string | undefined> = {
  lava: styles.burstLava,
  berserker: styles.burstBerserker,
  event: styles.burstEvent,
};

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
  isSwamp: boolean;
  isShaft: boolean;
  /** MOD-C005: the side whose queen guards this square, if any. */
  quietZone?: 'white' | 'black';
  /** MOD-C001: the side whose king closed this square's line, if any. */
  noFlyZone?: 'white' | 'black';
  burst?: SquareBurst;
  onClick: (square: SquareType) => void;
}

const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;
const SWAMP_ID = MODIFIER_IDS.thisIsMySwamp;

function getPieceTooltipLines(piece: PieceType | undefined): string[] {
  if (!piece) return [];

  const lines: string[] = [];

  if ((piece.cooldowns[GERALD_ID] ?? 0) > 0) {
    lines.push('Gerald: This piece is blocked and clearing it costs the turn.');
  }
  if ((piece.cooldowns[WINTER_ID] ?? 0) > 0) {
    lines.push('Winter Is Coming: This piece is frozen for one turn.');
  }
  if ((piece.cooldowns[SWAMP_ID] ?? 0) > 0) {
    lines.push('This Is My Swamp: This knight is stuck in the Swamp.');
  }
  if (piece.isPacifist) {
    lines.push('Conscientious Objector: This piece refuses to capture.');
  }
  if (piece.type === 'chancellor') {
    lines.push('Chancellor: Moves like a rook or a knight.');
  }
  if (piece.type === 'royal_guard') {
    lines.push('Royal Guard: Steps one square like a king. Losing it does not lose the game.');
  }
  if (piece.isTraitor) {
    lines.push('They Were The Traitor: This piece defects at the start of its owner\'s next turn.');
  }
  if (piece.hasPromotionChain) {
    lines.push('Reject Queen: This piece chains one extra capture on its next capture.');
  }
  if (piece.isBerserker) {
    lines.push('Berserker: This piece chain-captures when another capture exists.');
  }

  return lines;
}

function getTileTooltipLines(
  tileEffects: TileEffectType[],
  isFrozenZone: boolean,
  isSwamp: boolean,
  isShaft: boolean,
  quietZone: 'white' | 'black' | undefined,
  noFlyZone: 'white' | 'black' | undefined,
): string[] {
  const lines: string[] = [];

  if (tileEffects.includes('lava')) {
    lines.push('Floor Is Lava: Non-king pieces landing here are destroyed.');
  }
  if (isFrozenZone) {
    lines.push('Winter Is Coming: Pieces entering this zone must thaw before moving again.');
  }
  if (isShaft) {
    lines.push('Vent Tiles: An empty shaft. No piece can enter or cross it.');
  }
  if (isSwamp) {
    lines.push('This Is My Swamp: Pieces here move only 1 square. Knights landing here are stuck for 2 turns.');
  }

  if (noFlyZone) {
    lines.push(`I Hereby Declare: The ${noFlyZone} king closed this line. Enemy pieces cannot land on or cross it.`);
  }
  if (quietZone) {
    lines.push(`Quiet Quitting: The ${quietZone} queen's zone. Enemy pieces cannot enter.`);
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
  isSwamp,
  isShaft,
  quietZone,
  noFlyZone,
  burst,
  onClick,
}: SquareProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const colorClass = isLight ? styles.light : styles.dark;
  const hasLava = tileEffects.includes('lava');
  const pieceTooltipLines = getPieceTooltipLines(piece);
  const tileTooltipLines = getTileTooltipLines(tileEffects, isFrozenZone, isSwamp, isShaft, quietZone, noFlyZone);
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
        <div className={`${styles.tileEffectLayer} ${styles.frozenTint}`} aria-hidden="true" />
      )}

      {isShaft && (
        <div className={`${styles.tileEffectLayer} ${styles.shaft}`} aria-hidden="true" />
      )}

      {isSwamp && (
        <div className={`${styles.tileEffectLayer} ${styles.swampTint}`} aria-hidden="true">
          <div className={styles.swampIcon}>≈</div>
        </div>
      )}

      {noFlyZone && (
        <div className={`${styles.tileEffectLayer} ${styles.noFlyZone}`} aria-hidden="true" />
      )}

      {quietZone && (
        <div className={`${styles.tileEffectLayer} ${styles.quietZone}`} aria-hidden="true" />
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

      {burst && (
        <div
          key={burst.key}
          className={`${styles.burst} ${BURST_CLASS[burst.kind]}`}
          aria-hidden="true"
        />
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
