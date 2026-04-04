import type { Color, PieceType } from '../../engine/types';
import { playClick } from '../../sound';
import styles from './PromotionModal.module.css';

interface PromotionModalProps {
  color: Color;
  onChoose: (piece: PieceType) => void;
}

const CHOICES: { type: PieceType; whiteSymbol: string; blackSymbol: string; label: string }[] = [
  { type: 'queen',  whiteSymbol: '♕', blackSymbol: '♛', label: 'Queen'  },
  { type: 'rook',   whiteSymbol: '♖', blackSymbol: '♜', label: 'Rook'   },
  { type: 'bishop', whiteSymbol: '♗', blackSymbol: '♝', label: 'Bishop' },
  { type: 'knight', whiteSymbol: '♘', blackSymbol: '♞', label: 'Knight' },
];

export default function PromotionModal({ color, onChoose }: PromotionModalProps) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <div className={styles.card}>
        <p className={styles.heading}>Promote Pawn</p>
        <p className={styles.sub}>{color === 'white' ? 'White' : 'Black'} — choose a piece</p>
        <div className={styles.choices}>
          {CHOICES.map(({ type, whiteSymbol, blackSymbol, label }) => (
            <button
              key={type}
              className={`${styles.choice} ${styles[color]}`}
              onClick={() => {
                playClick();
                onChoose(type);
              }}
              aria-label={`Promote to ${label}`}
            >
              <span className={styles.symbol}>
                {color === 'white' ? whiteSymbol : blackSymbol}
              </span>
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
