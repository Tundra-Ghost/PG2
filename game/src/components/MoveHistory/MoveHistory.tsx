import { useEffect, useRef } from 'react';
import type { GameEvent, GameState } from '../../engine/types';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
  state: GameState;
  whiteLabel?: string;
  blackLabel?: string;
}

function formatActorMove(label: string, notation: string): string {
  return label === 'You' ? `${label} play: ${notation}` : `${label} plays: ${notation}`;
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [moveHistory.length, eventHistory.length]);

  const eventsByPly = new Map<number, GameEvent[]>();

  for (const event of eventHistory) {
    const existing = eventsByPly.get(event.ply) ?? [];
    existing.push(event);
    eventsByPly.set(event.ply, existing);
  }

  const entries: Array<{
    key: string;
    kind: 'move' | 'event';
    actor: string;
    text: string;
    detail?: string;
    emphasis: 'player' | 'opponent';
  }> = [];

  moveHistory.forEach((move, index) => {
    const ply = index + 1;
    const actor = move.pieceMoved.color === 'white' ? whiteLabel : blackLabel;
    const emphasis = move.pieceMoved.color === 'white' ? 'player' : 'opponent';

    entries.push({
      key: `move-${ply}`,
      kind: 'move',
      actor,
      text: formatActorMove(actor, move.notation),
      detail: `Ply ${ply}`,
      emphasis,
    });

    for (const event of eventsByPly.get(ply) ?? []) {
      entries.push({
        key: event.id,
        kind: 'event',
        actor: event.title,
        text: formatEventMessage(event.message, whiteLabel, blackLabel),
        detail: actor,
        emphasis,
      });
    }
  });

  const gameOver = status === 'checkmate' || status === 'draw';

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Chat / Moves</span>
        <span className={styles.moveCount}>
          {flags.fullMoveNumber > 1 || moveHistory.length > 0 ? `Move ${flags.fullMoveNumber}` : 'Live'}
        </span>
      </header>

      <div className={styles.list}>
        {entries.length === 0 && (
          <p className={styles.empty}>
            No moves yet. Modifier events will appear here as the match develops.
          </p>
        )}

        {entries.map(entry => (
          <div
            key={entry.key}
            className={`${styles.entry} ${
              entry.emphasis === 'player' ? styles.entryPlayer : styles.entryOpponent
            }`}
          >
            <div className={styles.entryMeta}>
              <span className={styles.entryActor}>{entry.actor}</span>
              {entry.detail ? <span className={styles.entryDetail}>{entry.detail}</span> : null}
            </div>
            <div
              className={`${styles.bubble} ${
                entry.kind === 'event' ? styles.bubbleEvent : styles.bubbleMove
              }`}
            >
              {entry.text}
            </div>
          </div>
        ))}

        {gameOver && (
          <div className={styles.resultRow}>
            {status === 'checkmate' && (
              <span className={styles.result}>{turn === 'white' ? '0 - 1' : '1 - 0'}</span>
            )}
            {status === 'draw' && <span className={styles.result}>1/2 - 1/2</span>}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
