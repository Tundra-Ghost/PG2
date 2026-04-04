import { useEffect, useRef } from 'react';
import type { GameEvent, GameState, MoveRecord } from '../../engine/types';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
  state: GameState;
  whiteLabel?: string;
  blackLabel?: string;
}

interface MovePair {
  number: number;
  white: MoveRecord;
  black?: MoveRecord;
}

interface PairEvents {
  white: GameEvent[];
  black: GameEvent[];
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

function formatActorMove(label: string, notation: string): string {
  return `${label} plays: ${notation}`;
}

function formatEventMessage(
  message: string,
  whiteLabel: string,
  blackLabel: string,
): string {
  return message
    .replace(/\bwhite ([a-z_]+)/gi, `${whiteLabel}'s $1`)
    .replace(/\bblack ([a-z_]+)/gi, `${blackLabel}'s $1`)
    .replace(/\bwhite\b/gi, whiteLabel)
    .replace(/\bblack\b/gi, blackLabel);
}

export default function MoveHistory({
  state,
  whiteLabel = 'White',
  blackLabel = 'Black',
}: MoveHistoryProps) {
  const { moveHistory, eventHistory, status, turn, flags } = state;
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMove = moveHistory[moveHistory.length - 1];

  // Auto-scroll to latest move
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [moveHistory.length, eventHistory.length]);

  const pairs = buildMovePairs(moveHistory);
  const gameOver = status === 'checkmate' || status === 'draw';
  const eventsByPly = new Map<number, GameEvent[]>();

  for (const event of eventHistory) {
    const existing = eventsByPly.get(event.ply) ?? [];
    existing.push(event);
    eventsByPly.set(event.ply, existing);
  }

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Match Log</span>
        <span className={styles.moveCount}>
          {flags.fullMoveNumber > 1 || (moveHistory.length > 0)
            ? `Move ${flags.fullMoveNumber}`
            : '—'}
        </span>
      </header>

      <div className={styles.list}>
        {pairs.length === 0 && (
          <p className={styles.empty}>No moves yet. Modifier events will land here.</p>
        )}

        {pairs.map(pair => (
          (() => {
            const whitePly = (pair.number - 1) * 2 + 1;
            const blackPly = whitePly + 1;
            const pairEvents: PairEvents = {
              white: eventsByPly.get(whitePly) ?? [],
              black: eventsByPly.get(blackPly) ?? [],
            };

            return (
              <div key={pair.number} className={styles.entry}>
                <div className={styles.row}>
                  <span className={styles.num}>{pair.number}.</span>

                  <span
                    className={`${styles.move} ${styles.white} ${
                      lastMove === pair.white ? styles.latest : ''
                    }`}
                  >
                    {formatActorMove(whiteLabel, pair.white.notation)}
                  </span>

                  <span
                    className={`${styles.move} ${styles.black} ${
                      pair.black && lastMove === pair.black ? styles.latest : ''
                    }`}
                  >
                    {pair.black ? formatActorMove(blackLabel, pair.black.notation) : ''}
                  </span>
                </div>

                {pairEvents.white.map(event => (
                  <div key={event.id} className={styles.eventRow}>
                    <span className={styles.eventSpacer} />
                    <div className={styles.eventCard}>
                      <span className={styles.eventTag}>{event.title}</span>
                      <span className={styles.eventText}>
                        {formatEventMessage(event.message, whiteLabel, blackLabel)}
                      </span>
                    </div>
                  </div>
                ))}

                {pairEvents.black.map(event => (
                  <div key={event.id} className={styles.eventRow}>
                    <span className={styles.eventSpacer} />
                    <div className={`${styles.eventCard} ${styles.eventCardAlt}`}>
                      <span className={styles.eventTag}>{event.title}</span>
                      <span className={styles.eventText}>
                        {formatEventMessage(event.message, whiteLabel, blackLabel)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
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
