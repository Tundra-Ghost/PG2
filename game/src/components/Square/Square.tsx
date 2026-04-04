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
  const colorClass = isLight ? styles.light : styles.dark;
  const hasLava = tileEffects.includes('lava');

  const overlayClass = isInCheck
    ? styles.check
    : isSelected
      ? styles.selected
      : isLastMove
        ? styles.lastMove
        : '';

  return (
    <div
      className={`${styles.square} ${colorClass} ${overlayClass}`}
      onClick={() => onClick(square)}
      data-square={square}
      role="button"
      aria-label={
        hasLava
          ? `${square}, lava`
          : isFrozenZone
            ? `${square}, frozen zone`
            : square
      }
      title={
        hasLava
          ? `${square}: Lava tile`
          : isFrozenZone
            ? `${square}: Frozen zone`
            : square
      }
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
    </div>
  );
}
