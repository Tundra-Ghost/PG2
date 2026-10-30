import type { Color, PieceType } from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import styles from './PromotionModal.module.css';
import PieceArt from '../Piece/PieceArt';

interface PromotionModalProps {
  color: Color;
  /** Pieces the modifiers allow. Defaults to all four. */
  allowed?: readonly PieceType[];
  onChoose: (piece: PieceType) => void;
}

const CHOICES: { type: PieceType; label: string }[] = [
  { type: 'queen', label: 'Queen' },
  { type: 'rook', label: 'Rook' },
  { type: 'bishop', label: 'Bishop' },
  { type: 'knight', label: 'Knight' },
];

export default function PromotionModal({ color, allowed, onChoose }: PromotionModalProps) {
  const choices = allowed ? CHOICES.filter(choice => allowed.includes(choice.type)) : CHOICES;
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <div className={styles.card}>
        <p className={styles.heading}>Promote Pawn</p>
        <p className={styles.sub}>{color === 'white' ? 'White' : 'Black'} — choose a piece</p>
        <div className={styles.choices}>
          {choices.map(({ type, label }) => (
            <button
              key={type}
              className={`${styles.choice} ${styles[color]}`}
              onClick={() => {
                playClick();
                onChoose(type);
              }}
              aria-label={`Promote to ${label}`}
            >
              <PieceArt type={type} color={color} className={styles.symbol} />
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
