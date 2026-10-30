import type { Piece as ChessPiece } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import styles from './Piece.module.css';
import PieceArt from './PieceArt';

interface PieceProps {
  piece: ChessPiece;
}

const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;
const SWAMP_ID = MODIFIER_IDS.thisIsMySwamp;

export default function Piece({ piece }: PieceProps) {
  const { type, color, cooldowns, isPacifist, isBerserker, isTraitor, hasPromotionChain } = piece;
  const markers: string[] = [];

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
      <PieceArt type={type} color={color} className={styles.symbol} />
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
