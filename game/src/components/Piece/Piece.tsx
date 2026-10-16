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
  chancellor: '♜', // MOD-E004: a rook glyph with a C badge
  royal_guard: '♚', // MOD-E003: a king glyph with a shield badge
};

const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;
const SWAMP_ID = MODIFIER_IDS.thisIsMySwamp;

export default function Piece({ piece }: PieceProps) {
  const { type, color, cooldowns, isPacifist, isBerserker, isTraitor, hasPromotionChain } = piece;
  const symbol = SYMBOLS[type] ?? '?';
  const markers: string[] = [];

  if (type === 'chancellor') markers.push('C');
  if (type === 'royal_guard') markers.push('⛨');
  if ((cooldowns[GERALD_ID] ?? 0) > 0) markers.push('G');
  if ((cooldowns[WINTER_ID] ?? 0) > 0) markers.push('❄');
  if ((cooldowns[SWAMP_ID] ?? 0) > 0) markers.push('≈');
  if (isPacifist) markers.push('O');
  if (isBerserker) markers.push('B');
  if (isTraitor) markers.push('!');
  if (hasPromotionChain) markers.push('»');

  const markerLabel = [
    (cooldowns[GERALD_ID] ?? 0) > 0 ? 'gerald blocked' : null,
    (cooldowns[WINTER_ID] ?? 0) > 0 ? 'frozen' : null,
    (cooldowns[SWAMP_ID] ?? 0) > 0 ? 'stuck in the swamp' : null,
    isPacifist ? 'pacifist' : null,
    isBerserker ? 'berserker' : null,
    isTraitor ? 'traitor' : null,
    hasPromotionChain ? 'chain ready' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className={[
        styles.piece,
        styles[color],
        isBerserker ? styles.berserker : '',
        isTraitor ? styles.traitor : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${color} ${type === 'royal_guard' ? 'royal guard' : type}${markerLabel ? `, ${markerLabel}` : ''}`}
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
                marker === '!' ? styles.markerTraitor : '',
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
