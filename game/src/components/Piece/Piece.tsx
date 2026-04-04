import type { Color, Piece as ChessPiece, PieceType } from '../../engine/types';
import styles from './Piece.module.css';

interface PieceProps {
  piece: ChessPiece;
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

const GERALD_ID = 'MOD-B002';
const WINTER_ID = 'MOD-A004';

export default function Piece({ piece }: PieceProps) {
  const { type, color, cooldowns, isPacifist, isBerserker } = piece;
  const symbol = SYMBOLS[color][type] ?? '?';
  const markers: string[] = [];

  if ((cooldowns[GERALD_ID] ?? 0) > 0) markers.push('G');
  if ((cooldowns[WINTER_ID] ?? 0) > 0) markers.push('F');
  if (isPacifist) markers.push('O');
  if (isBerserker) markers.push('B');

  const markerLabel = [
    (cooldowns[GERALD_ID] ?? 0) > 0 ? 'gerald blocked' : null,
    (cooldowns[WINTER_ID] ?? 0) > 0 ? 'frozen' : null,
    isPacifist ? 'pacifist' : null,
    isBerserker ? 'berserker' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className={`${styles.piece} ${styles[color]}`}
      aria-label={markerLabel ? `${color} ${type}, ${markerLabel}` : `${color} ${type}`}
    >
      <span className={styles.symbol}>{symbol}</span>
      {markers.length > 0 && (
        <span className={styles.markerStack} aria-hidden="true">
          {markers.map(marker => (
            <span key={marker} className={styles.marker}>
              {marker}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
