import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent, GameState } from '../../engine/types';
import { playClick } from '../../sound';
import type { MatchChatEntry } from '../../App';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
  state: GameState;
  whiteLabel?: string;
  blackLabel?: string;
  chatEntries?: MatchChatEntry[];
  onSendChat?: (text: string) => void;
  playerAvatarLabel?: string;
}

interface FeedEntry {
  key: string;
  kind: 'move' | 'event' | 'chat';
  actor: string;
  text: string;
  detail?: string;
  emphasis: 'player' | 'opponent';
  order: number;
  avatarLabel?: string;
  avatarIcon?: string | null;
  portraitSrc?: string | null;
  portraitSlotLabel?: string;
  animated?: boolean;
}

function TypewriterBubble({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setVisibleCount(0);
    setRevealed(false);
  }, [text]);

  useEffect(() => {
    if (revealed || visibleCount >= text.length) return;
    const timer = setTimeout(() => setVisibleCount(count => count + 1), 16);
    return () => clearTimeout(timer);
  }, [revealed, text.length, visibleCount]);

  const done = revealed || visibleCount >= text.length;
  const displayText = done ? text : text.slice(0, visibleCount);

  return (
    <button
      type="button"
      className={`${className} ${styles.typewriterButton}`}
      onClick={() => {
        if (done) return;
        playClick();
        setRevealed(true);
      }}
    >
      {displayText}
      {!done && <span className={styles.cursor}>|</span>}
    </button>
  );
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
  chatEntries = [],
  onSendChat,
  playerAvatarLabel = 'P',
}: MoveHistoryProps) {
  const { moveHistory, eventHistory, status, turn, flags } = state;
  const [draftChat, setDraftChat] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [moveHistory.length, eventHistory.length, chatEntries.length]);

  const entries = useMemo(() => {
    const eventsByPly = new Map<number, GameEvent[]>();
    for (const event of eventHistory) {
      const existing = eventsByPly.get(event.ply) ?? [];
      existing.push(event);
      eventsByPly.set(event.ply, existing);
    }

    const feedEntries: FeedEntry[] = [];

    moveHistory.forEach((move, index) => {
      const ply = index + 1;
      const actor = move.pieceMoved.color === 'white' ? whiteLabel : blackLabel;
      const emphasis = move.pieceMoved.color === 'white' ? 'player' : 'opponent';

      feedEntries.push({
        key: `move-${ply}`,
        kind: 'move',
        actor,
        text: formatActorMove(actor, move.notation),
        detail: `Ply ${ply}`,
        emphasis,
        order: ply * 100,
        avatarLabel: actor.slice(0, 1).toUpperCase(),
      });

      for (const [eventIndex, event] of (eventsByPly.get(ply) ?? []).entries()) {
        feedEntries.push({
          key: event.id,
          kind: 'event',
          actor: event.title,
          text: formatEventMessage(event.message, whiteLabel, blackLabel),
          detail: actor,
          emphasis,
          order: ply * 100 + eventIndex + 1,
          avatarLabel: event.title.slice(0, 1).toUpperCase(),
        });
      }
    });

    for (const chat of chatEntries) {
      feedEntries.push({
        key: chat.id,
        kind: 'chat',
        actor: chat.author,
        text: chat.text,
        detail: chat.source === 'player' ? 'You' : 'Bot',
        emphasis: chat.source === 'player' ? 'player' : 'opponent',
        order: chat.order,
        avatarLabel: chat.avatarLabel,
        avatarIcon: chat.avatarIcon,
        portraitSrc: chat.portraitSrc,
        portraitSlotLabel: chat.portraitSlotLabel,
        animated: true,
      });
    }

    return feedEntries.sort((a, b) => a.order - b.order);
  }, [blackLabel, chatEntries, eventHistory, moveHistory, whiteLabel]);

  const gameOver = status === 'checkmate' || status === 'draw';

  function handleSend() {
    const trimmed = draftChat.trim();
    if (!trimmed || !onSendChat) return;
    playClick();
    onSendChat(trimmed);
    setDraftChat('');
  }

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Chat / Moves</span>
        <span className={styles.moveCount}>
          {flags.fullMoveNumber > 1 || moveHistory.length > 0 ? `Move ${flags.fullMoveNumber}` : 'Live'}
        </span>
      </header>

      {onSendChat ? (
        <div className={styles.composer}>
          <div className={styles.composerAvatar}>{playerAvatarLabel}</div>
          <input
            className={styles.composerInput}
            type="text"
            value={draftChat}
            maxLength={120}
            placeholder="Say something..."
            onChange={e => setDraftChat(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button className={styles.composerBtn} type="button" onClick={handleSend}>
            Send
          </button>
        </div>
      ) : null}

      <div className={styles.list}>
        {entries.length === 0 && (
          <p className={styles.empty}>
            No moves yet. Chat, moves, and modifier events will appear here as the match develops.
          </p>
        )}

        {entries.map(entry => (
          <div
            key={entry.key}
            className={`${styles.entry} ${
              entry.emphasis === 'player' ? styles.entryPlayer : styles.entryOpponent
            }`}
          >
            {entry.kind === 'chat' ? (
              <div
                className={`${styles.dialogueCard} ${
                  entry.emphasis === 'player' ? styles.dialogueCardPlayer : styles.dialogueCardOpponent
                }`}
              >
                <div className={styles.dialogueHeader}>
                  <span className={styles.dialogueNameplate}>{entry.actor}</span>
                  {entry.detail ? <span className={styles.entryDetail}>{entry.detail}</span> : null}
                </div>
                <div className={styles.dialogueBody}>
                  <div className={styles.dialogueBubble}>
                    {entry.animated ? (
                      <TypewriterBubble
                        text={entry.text}
                        className={`${styles.bubble} ${styles.bubbleChat} ${styles.bubbleDialogue}`}
                      />
                    ) : (
                      <div className={`${styles.bubble} ${styles.bubbleChat} ${styles.bubbleDialogue}`}>
                        {entry.text}
                      </div>
                    )}
                  </div>
                  <div className={styles.dialoguePortraitFrame} aria-hidden="true">
                    {entry.portraitSrc ? (
                      <img
                        src={entry.portraitSrc}
                        alt=""
                        className={styles.dialoguePortraitImage}
                      />
                    ) : entry.avatarIcon ? (
                      <div className={styles.dialoguePortraitPlaceholder}>
                        <span className={styles.dialoguePortraitSlotLabel}>
                          {entry.portraitSlotLabel ?? 'Portrait Slot'}
                        </span>
                        <span className={styles.dialoguePortraitIcon}>{entry.avatarIcon}</span>
                      </div>
                    ) : (
                      <div className={styles.dialoguePortraitPlaceholder}>
                        <span className={styles.dialoguePortraitSlotLabel}>
                          {entry.portraitSlotLabel ?? 'Portrait Slot'}
                        </span>
                        <span className={styles.dialoguePortraitLabel}>{entry.avatarLabel ?? '?'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.entryMeta}>
                  {entry.avatarIcon ? (
                    <span className={styles.entryAvatar} aria-hidden="true">
                      {entry.avatarIcon}
                    </span>
                  ) : (
                    <span className={styles.entryAvatar}>{entry.avatarLabel ?? '?'}</span>
                  )}
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
              </>
            )}
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
