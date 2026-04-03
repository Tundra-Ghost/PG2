import { useEffect, useRef } from 'react';
import type { GameState, MoveRecord } from '../../engine/types';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
  state: GameState;
}

interface MovePair {
  number: number;
  white: MoveRecord;
  black?: MoveRecord;
}

function buildMovePairs(history: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }
  return pairs;
}

export default function MoveHistory({ state }: MoveHistoryProps) {
  const { moveHistory, status, turn, flags } = state;
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMove = moveHistory[moveHistory.length - 1];

  // Auto-scroll to latest move
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [moveHistory.length]);

  const pairs = buildMovePairs(moveHistory);
  const gameOver = status === 'checkmate' || status === 'draw';

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Move History</span>
        <span className={styles.moveCount}>
          {flags.fullMoveNumber > 1 || (moveHistory.length > 0)
            ? `Move ${flags.fullMoveNumber}`
            : '—'}
        </span>
      </header>

      <div className={styles.list}>
        {pairs.length === 0 && (
          <p className={styles.empty}>No moves yet.</p>
        )}

        {pairs.map(pair => (
          <div key={pair.number} className={styles.row}>
            <span className={styles.num}>{pair.number}.</span>

            <span
              className={`${styles.move} ${styles.white} ${
                lastMove === pair.white ? styles.latest : ''
              }`}
            >
              {pair.white.notation}
            </span>

            <span
              className={`${styles.move} ${styles.black} ${
                pair.black && lastMove === pair.black ? styles.latest : ''
              }`}
            >
              {pair.black?.notation ?? ''}
            </span>
          </div>
        ))}

        {/* Status footer row */}
        {gameOver && (
          <div className={styles.resultRow}>
            {status === 'checkmate' && (
              <span className={styles.result}>
                {turn === 'white' ? '0 – 1' : '1 – 0'}
              </span>
            )}
            {status === 'draw' && (
              <span className={styles.result}>½ – ½</span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
