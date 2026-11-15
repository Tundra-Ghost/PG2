import { useEffect, useState, type ReactNode } from 'react';
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
  /** Who the player is, so the result says "You win" or "Chick wins" instead of a colour. */
  sides?: { you?: Side; names?: Partial<Record<Side, string>> };
  /** Opens the optional post-game debrief. The result card shows a button for it when set. */
  onDebrief?: () => void;
}

type Side = 'white' | 'black';

function sideName(side: Side, sides: GameStatusProps['sides'], subject = false): string {
  if (sides?.you === side) return subject ? 'You' : 'you';
  return sides?.names?.[side] ?? (side === 'white' ? 'White' : 'Black');
}

const DRAW_LABELS: Record<string, string> = {
  stalemate:   'by stalemate',
  '50-move':   '50-move rule',
  threefold:   'threefold repetition',
  insufficient: 'insufficient material',
  agreement:   'by agreement',
};

function getStatusMessage(
  state: GameState,
  sides: GameStatusProps['sides'],
): { emoji: string; headline: string; sub: string } | null {
  const winner = getWinner(state);
  if (winner && winner !== 'draw') {
    const resigned = state.resignedBy as Side | undefined;
    return {
      emoji: winner === 'white' ? '♔' : '♚',
      headline: sides?.you === winner ? 'You win' : `${sideName(winner, sides, true)} wins`,
      sub: state.status === 'resigned' && resigned ? `${sideName(resigned, sides, true)} resigned` : 'by checkmate',
    };
  }
  if (winner === 'draw') {
    const label = DRAW_LABELS[state.drawReason ?? 'stalemate'] ?? 'draw';
    return { emoji: '🕊️', headline: 'Draw', sub: label };
  }
  return null;
}

export default function GameStatus({
  state,
  onNewGame,
  infoMessage,
  actionLabel = 'New Game',
  controls,
  sides,
  onDebrief,
}: GameStatusProps) {
  const msg = getStatusMessage(state, sides);
  const isOver = msg !== null;
  // "See board" tucks the result card away so the final position is visible.
  const [seeBoard, setSeeBoard] = useState(false);
  useEffect(() => setSeeBoard(false), [state.id]);

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
        {isOver && seeBoard && (
          <span className={styles.resultLine}>
            <strong>{msg!.headline}</strong> {msg!.sub}
          </span>
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

      {isOver && !seeBoard && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard} role="dialog" aria-labelledby="game-result">
            <div className={styles.overlayEmoji} aria-hidden="true">{msg!.emoji}</div>
            <div id="game-result" className={styles.overlayHeadline}>{msg!.headline}</div>
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
            <div className={styles.overlayLinks}>
              <button
                type="button"
                className={styles.overlayLink}
                onClick={() => {
                  playClick();
                  setSeeBoard(true);
                }}
              >
                See board
              </button>
              {onDebrief && (
                <button
                  type="button"
                  className={styles.overlayLink}
                  onClick={() => {
                    playClick();
                    onDebrief();
                  }}
                >
                  Quick debrief
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isOver && seeBoard && (
        <div className={styles.resultActions}>
          <button
            type="button"
            className={styles.newGameBtnSmall}
            onClick={() => {
              playClick();
              setSeeBoard(false);
            }}
          >
            Show result
          </button>
          <button
            type="button"
            className={styles.newGameBtnSmall}
            onClick={() => {
              playClick();
              onNewGame();
            }}
          >
            {actionLabel}
          </button>
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
