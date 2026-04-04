import type { Color, GameState } from '../../engine/types';
import { playClick } from '../../sound';
import styles from './GameStatus.module.css';

interface GameStatusProps {
  state: GameState;
  onNewGame: () => void;
  infoMessage?: string | null;
}

const DRAW_LABELS: Record<string, string> = {
  stalemate:   'by stalemate',
  '50-move':   '50-move rule',
  threefold:   'threefold repetition',
  insufficient: 'insufficient material',
};

function getStatusMessage(state: GameState): { emoji: string; headline: string; sub: string } | null {
  if (state.status === 'checkmate') {
    const winner: Color = state.turn === 'white' ? 'black' : 'white';
    return {
      emoji: winner === 'white' ? '♔' : '♚',
      headline: `${winner.toUpperCase()} WINS`,
      sub: 'by checkmate',
    };
  }
  if (state.status === 'draw') {
    const label = DRAW_LABELS[state.drawReason ?? 'stalemate'] ?? 'draw';
    return { emoji: '🕊️', headline: 'DRAW', sub: label };
  }
  return null;
}

export default function GameStatus({ state, onNewGame, infoMessage }: GameStatusProps) {
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

      {!isOver && (
        <div className={styles.centerStatus}>
          {infoMessage ? (
            <span className={styles.infoPill}>{infoMessage}</span>
          ) : (
            <span className={styles.idlePill}>Board live. Modifiers armed.</span>
          )}
        </div>
      )}

      {isOver && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.overlayEmoji}>{msg!.emoji}</div>
            <div className={styles.overlayHeadline}>{msg!.headline}</div>
            <div className={styles.overlaySub}>{msg!.sub}</div>
            <button
              className={styles.newGameBtn}
              onClick={() => {
                playClick();
                onNewGame();
              }}
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {!isOver && (
        <button
          className={styles.newGameBtnSmall}
          onClick={() => {
            playClick();
            onNewGame();
          }}
        >
          New Game
        </button>
      )}
    </div>
  );
}
