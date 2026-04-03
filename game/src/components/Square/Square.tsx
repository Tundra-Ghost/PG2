import type { Color, Piece as PieceType, Square as SquareType } from '../../engine/types';
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
  onClick,
}: SquareProps) {
  const colorClass = isLight ? styles.light : styles.dark;

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
      aria-label={square}
      tabIndex={-1}
    >
      {piece && <PieceComponent type={piece.type} color={piece.color} />}
      {isLegalTarget && (
        <div className={piece ? styles.captureDot : styles.legalDot} />
      )}
    </div>
  );
}
