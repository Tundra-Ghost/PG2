import type { Color, GameState } from '../../engine/types';
import styles from './GameStatus.module.css';

interface GameStatusProps {
  state: GameState;
  onNewGame: () => void;
}

function getStatusMessage(state: GameState): { headline: string; sub: string } | null {
  if (state.status === 'checkmate') {
    const winner: Color = state.turn === 'white' ? 'black' : 'white';
    return {
      headline: `${winner.toUpperCase()} WINS`,
      sub: 'by checkmate',
    };
  }
  if (state.status === 'draw') {
    const reason = state.flags.halfMoveClock >= 100 ? '50-move rule' : 'stalemate';
    return { headline: 'DRAW', sub: reason };
  }
  return null;
}

export default function GameStatus({ state, onNewGame }: GameStatusProps) {
  const msg = getStatusMessage(state);
  const isOver = msg !== null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.turnIndicator}>
        {!isOver && (
          <>
            <span
              className={`${styles.dot} ${state.turn === 'white' ? styles.dotWhite : styles.dotBlack}`}
            />
            <span className={styles.turnText}>
              {state.turn.toUpperCase()} TO MOVE
            </span>
            {(state.status === 'active') && state.moveHistory.length > 0 && (
              <span className={styles.moveNum}>
                Move {state.flags.fullMoveNumber}
              </span>
            )}
          </>
        )}
      </div>

      {isOver && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.overlayEmoji}>🐦</div>
            <div className={styles.overlayHeadline}>{msg!.headline}</div>
            <div className={styles.overlaySub}>{msg!.sub}</div>
            <button className={styles.newGameBtn} onClick={onNewGame}>
              New Game
            </button>
          </div>
        </div>
      )}

      {!isOver && (
        <button className={styles.newGameBtnSmall} onClick={onNewGame}>
          New Game
        </button>
      )}
    </div>
  );
}
