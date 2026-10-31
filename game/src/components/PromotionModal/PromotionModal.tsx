import type { Color, PieceType } from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import styles from './PromotionModal.module.css';
import PieceArt from '../Piece/PieceArt';

interface PromotionModalProps {
  color: Color;
  /** Pieces the modifiers allow. Defaults to the four promotion pieces. */
  allowed?: readonly PieceType[];
  onChoose: (piece: PieceType) => void;
  /** Also used to pick a Moneyball drop. */
  heading?: string;
  /** Shows a Cancel button. */
  onCancel?: () => void;
}

const CHOICES: { type: PieceType; label: string }[] = [
  { type: 'queen', label: 'Queen' },
  { type: 'rook', label: 'Rook' },
  { type: 'bishop', label: 'Bishop' },
  { type: 'knight', label: 'Knight' },
  { type: 'chancellor', label: 'Chancellor' },
  { type: 'royal_guard', label: 'Royal Guard' },
  { type: 'pigeon', label: 'Pigeon' },
  { type: 'pawn', label: 'Pawn' },
];

export default function PromotionModal({ color, allowed, onChoose, heading = 'Promote Pawn', onCancel }: PromotionModalProps) {
  const choices = CHOICES.filter(choice => (allowed ?? CHOICES.slice(0, 4).map(c => c.type)).includes(choice.type));
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={heading}>
      <div className={styles.card}>
        <p className={styles.heading}>{heading}</p>
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
              aria-label={heading === 'Promote Pawn' ? `Promote to ${label}` : label}
            >
              <PieceArt type={type} color={color} className={styles.symbol} />
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
