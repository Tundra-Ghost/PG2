import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MODIFIER_IDS,
  blackoutMovesLeft,
  getWinner,
  isHistoryBlackout,
  type Color,
  type GameEvent,
  type GameState,
} from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import { formatActorMove, formatEventMessage, type MatchChatEntry } from '../../matchFeed';
import styles from './MoveHistory.module.css';
import DialogueBox from '../DialogueBox/DialogueBox';

const RESULT_TEXT = { white: '1 - 0', black: '0 - 1', draw: '1/2 - 1/2' } as const;

interface MoveHistoryProps {
  state: GameState;
  whiteLabel?: string;
  blackLabel?: string;
  chatEntries?: MatchChatEntry[];
  onSendChat?: (text: string) => void;
  playerAvatarLabel?: string;
  playerAvatarSrc?: string | null;
  opponentAvatarIcon?: string | null;
  pendingDialogue?: MatchChatEntry | null;
  onDismissDialogue?: () => void;
  /** The side reading the feed. Defaults to the side to move (hotseat). */
  viewerColor?: Color;
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
  dialogueTheme?: 'player' | 'chick' | 'measured' | 'grandmaster' | 'npc';
  dialogueExpression?: 'neutral' | 'shocked' | 'smug' | 'frustrated';
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

export default function MoveHistory({
  state,
  whiteLabel = 'White',
  blackLabel = 'Black',
  chatEntries = [],
  onSendChat,
  playerAvatarLabel = 'P',
  playerAvatarSrc = null,
  opponentAvatarIcon = null,
  pendingDialogue = null,
  onDismissDialogue,
  viewerColor,
}: MoveHistoryProps) {
  const { moveHistory, eventHistory, status, turn, flags } = state;
  // MOD-B005: the cursed side forgets the moves and events for a while.
  const blackout = status === 'active' && isHistoryBlackout(state, viewerColor ?? turn);
  const blackoutLeft = blackout ? blackoutMovesLeft(state) : 0;
  const [draftChat, setDraftChat] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the list itself. scrollIntoView would drag the whole page with it.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
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
      const isWhite = move.pieceMoved.color === 'white';
      const actor = isWhite ? whiteLabel : blackLabel;
      const emphasis = isWhite ? 'player' : 'opponent';
      const visibleEvents = (eventsByPly.get(ply) ?? []).filter(event => !blackout || event.modifierId === MODIFIER_IDS.fiftyFirstMoves);

      if (!blackout) feedEntries.push({
        key: `move-${ply}`,
        kind: 'move',
        actor,
        text: formatActorMove(actor, move.notation),
        detail: `Ply ${ply}`,
        emphasis,
        order: ply * 100,
        avatarLabel: actor.slice(0, 1).toUpperCase(),
        avatarIcon: isWhite ? null : (opponentAvatarIcon ?? undefined),
        portraitSrc: isWhite ? playerAvatarSrc : null,
      });

      for (const [eventIndex, event] of visibleEvents.entries()) {
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

    if (blackout) {
      feedEntries.push({
        key: 'blackout',
        kind: 'event',
        actor: '50 First Moves',
        text: `You cannot remember any moves. Your memory returns in ${blackoutLeft} move${blackoutLeft === 1 ? '' : 's'}.`,
        emphasis: 'opponent',
        order: moveHistory.length * 100 + 99,
        avatarLabel: '?',
      });
    }

    for (const chat of chatEntries) {
      feedEntries.push({
        key: chat.id,
        kind: 'chat',
        actor: chat.author,
        text: chat.text,
        detail: chat.source === 'player' ? 'You' : (chat.sourceLabel ?? 'Bot'),
        emphasis: chat.source === 'player' ? 'player' : 'opponent',
        order: chat.order,
        avatarLabel: chat.avatarLabel,
        avatarIcon: chat.avatarIcon,
        portraitSrc: chat.portraitSrc,
        portraitSlotLabel: chat.portraitSlotLabel,
        dialogueTheme: chat.dialogueTheme,
        dialogueExpression: chat.dialogueExpression,
        animated: !chat.shownInDialogue,
      });
    }

    return feedEntries.sort((a, b) => a.order - b.order);
  }, [
    blackout,
    blackoutLeft,
    blackLabel,
    chatEntries,
    eventHistory,
    moveHistory,
    opponentAvatarIcon,
    playerAvatarSrc,
    whiteLabel,
  ]);

  const gameOver = status === 'checkmate' || status === 'draw' || status === 'resigned';

  function handleSend() {
    const trimmed = draftChat.trim();
    if (!trimmed || !onSendChat) return;
    playClick();
    onSendChat(trimmed);
    setDraftChat('');
  }

  return (
    <aside className={styles.panel}>
      {pendingDialogue && onDismissDialogue ? (
        <div className={styles.mobileDialogueOverlay}>
          <DialogueBox
            entry={pendingDialogue}
            onDismiss={onDismissDialogue}
            variant="panelOverlay"
          />
        </div>
      ) : null}

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

      <div ref={listRef} className={styles.list}>
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
                } ${styles[`theme${(entry.dialogueTheme ?? 'npc').charAt(0).toUpperCase()}${(entry.dialogueTheme ?? 'npc').slice(1)}`]} ${
                  styles[`expression${(entry.dialogueExpression ?? 'neutral').charAt(0).toUpperCase()}${(entry.dialogueExpression ?? 'neutral').slice(1)}`]
                }`}
              >
                <div className={styles.dialogueHeader}>
                  {entry.avatarIcon ? (
                    <span className={styles.dialogueInlineAvatar} aria-hidden="true">
                      {entry.avatarIcon}
                    </span>
                  ) : entry.portraitSrc ? (
                    <img
                      src={entry.portraitSrc}
                      alt=""
                      className={styles.dialogueInlineAvatarImg}
                    />
                  ) : null}
                  <span className={styles.dialogueNameplate}>{entry.actor}</span>
                  {entry.detail ? <span className={styles.entryDetail}>{entry.detail}</span> : null}
                </div>
                <div className={styles.dialogueBody}>
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
              </div>
            ) : (
              <>
                <div className={styles.entryMeta}>
                  {entry.portraitSrc ? (
                    <img src={entry.portraitSrc} alt="" className={styles.entryAvatarImg} />
                  ) : entry.avatarIcon ? (
                    <span className={styles.entryAvatarEmoji} aria-hidden="true">
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
            <span className={styles.result}>{RESULT_TEXT[getWinner(state) ?? 'draw']}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
