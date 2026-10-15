import type { ReactNode } from 'react';
import { getWinner, type GameState } from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import styles from './GameStatus.module.css';

interface GameStatusProps {
  state: GameState;
  onNewGame: () => void;
  infoMessage?: string | null;
  /** Label for the restart button. Online play uses it to leave the room. */
  actionLabel?: string;
  /** Extra match controls shown next to the action button (online resign / draw). */
  controls?: ReactNode;
}

const DRAW_LABELS: Record<string, string> = {
  stalemate:   'by stalemate',
  '50-move':   '50-move rule',
  threefold:   'threefold repetition',
  insufficient: 'insufficient material',
  agreement:   'by agreement',
};

function getStatusMessage(state: GameState): { emoji: string; headline: string; sub: string } | null {
  const winner = getWinner(state);
  if (winner && winner !== 'draw') {
    return {
      emoji: winner === 'white' ? '♔' : '♚',
      headline: `${winner.toUpperCase()} WINS`,
      sub: state.status === 'resigned' ? `${state.resignedBy} resigned` : 'by checkmate',
    };
  }
  if (winner === 'draw') {
    const label = DRAW_LABELS[state.drawReason ?? 'stalemate'] ?? 'draw';
    return { emoji: '🕊️', headline: 'DRAW', sub: label };
  }
  return null;
}

export default function GameStatus({ state, onNewGame, infoMessage, actionLabel = 'New Game', controls }: GameStatusProps) {
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
            <span className={styles.idlePill}>
              {state.activeModifiers.length > 0 ? 'Board live. Modifiers armed.' : 'Board live. Standard rules.'}
            </span>
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
              {actionLabel}
            </button>
          </div>
        </div>
      )}

      {!isOver && controls}

      {!isOver && (
        <button
          className={styles.newGameBtnSmall}
          onClick={() => {
            playClick();
            onNewGame();
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
