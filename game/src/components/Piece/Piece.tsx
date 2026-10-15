import type { Piece as ChessPiece, PieceType } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import styles from './Piece.module.css';

interface PieceProps {
  piece: ChessPiece;
}

// Both colours use the solid glyphs. The outline glyphs (♙ etc.) have a
// transparent body, so white pieces looked hollow and black pieces on dark
// squares read as white. Colour now comes from CSS fill and stroke alone.
const SYMBOLS: Partial<Record<PieceType, string>> = {
  king: '♚',
  queen: '♛',
  rook: '♜',
  bishop: '♝',
  knight: '♞',
  pawn: '♟',
};

const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;

export default function Piece({ piece }: PieceProps) {
  const { type, color, cooldowns, isPacifist, isBerserker } = piece;
  const symbol = SYMBOLS[type] ?? '?';
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
      className={[
        styles.piece,
        styles[color],
        isBerserker ? styles.berserker : '',
      ].filter(Boolean).join(' ')}
      aria-label={markerLabel ? `${color} ${type}, ${markerLabel}` : `${color} ${type}`}
    >
      <span className={styles.symbol}>{symbol}</span>
      {markers.length > 0 && (
        <span className={styles.markerStack} aria-hidden="true">
          {markers.map(marker => (
            <span
              key={marker}
              className={[
                styles.marker,
                marker === 'B' ? styles.markerBerserker : '',
              ].filter(Boolean).join(' ')}
            >
              {marker}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
