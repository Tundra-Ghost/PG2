import type { Color, PieceType } from '../../engine/types';
import styles from './Piece.module.css';

interface PieceProps {
  type: PieceType;
  color: Color;
}

const SYMBOLS: Record<Color, Partial<Record<PieceType, string>>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
};

export default function Piece({ type, color }: PieceProps) {
  const symbol = SYMBOLS[color][type] ?? '?';
  return (
    <span className={`${styles.piece} ${styles[color]}`} aria-label={`${color} ${type}`}>
      {symbol}
    </span>
  );
}
