import { SPRITES } from '../../characters';
import type { Piece as ChessPiece } from '@pigeon-chess/game-core';
import styles from './Piece.module.css';
import PieceArt from './PieceArt';
import { getPieceMarkers } from './pieceMarkers';

interface PieceProps {
  piece: ChessPiece;
}

export default function Piece({ piece }: PieceProps) {
  const { type, color } = piece;
  const { marks: markers, gerald, berserker, traitor, label: markerLabel } = getPieceMarkers(piece);

  return (
    <span
      className={[
        styles.piece,
        styles[color],
        berserker ? styles.berserker : '',
        traitor ? styles.traitor : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${color} ${type === 'royal_guard' ? 'royal guard' : type}${markerLabel ? `, ${markerLabel}` : ''}`}
    >
      <PieceArt type={type} color={color} className={styles.symbol} />
      {gerald && <img src={SPRITES.gerald} alt="" className={styles.gerald} />}
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
