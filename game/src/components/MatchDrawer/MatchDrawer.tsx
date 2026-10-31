import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchChatEntry } from '../../matchFeed';
import { playClick } from '../../sound';
import styles from './MatchDrawer.module.css';

/** How long a chat bubble stays on a player strip. */
const BUBBLE_MS = 4000;

export type DrawerTab = 'feed' | 'modifiers';

interface Bubble {
  side: 'self' | 'opponent';
  text: string;
}

const sideOf = (entry: MatchChatEntry): Bubble['side'] => (entry.source === 'player' ? 'self' : 'opponent');

/**
 * The phone match panels: closed by default so the page never has to move,
 * with chat previewed as brief bubbles and an unread count on the bar.
 * `liveLine` is a line being spoken right now (a bot's dialogue); it is shown
 * for as long as it lasts instead of bubbling again when it reaches the log.
 */
export function useMatchDrawer(chatEntries: MatchChatEntry[], liveLine: MatchChatEntry | null = null) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('feed');
  const [unread, setUnread] = useState(0);
  const [flash, setFlash] = useState<Bubble | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const before = seen.current;
    seen.current = new Set(chatEntries.map(entry => entry.id));
    if (chatEntries.length === 0) setUnread(0);
    if (!before || openRef.current) return;
    const fresh = chatEntries.filter(entry => !before.has(entry.id));
    // More than one at once is history arriving after a rejoin, not news.
    if (fresh.length !== 1) return;
    const entry = fresh[0];
    if (entry.source !== 'player') setUnread(count => count + 1);
    if (!entry.spokenLive) setFlash({ side: sideOf(entry), text: entry.text });
  }, [chatEntries]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const select = useCallback((next: DrawerTab) => {
    playClick();
    setTab(next);
    setOpen(wasOpen => !(wasOpen && tab === next));
    if (next === 'feed') setUnread(0);
  }, [tab]);

  const setOpenAndClear = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setUnread(0);
  }, []);

  const bubble: Bubble | null = open
    ? null
    : liveLine
      ? { side: sideOf(liveLine), text: liveLine.text }
      : flash;

  return { open, tab, unread, bubble, select, setOpen: setOpenAndClear };
}

export type MatchDrawerState = ReturnType<typeof useMatchDrawer>;

/** A chat line laid over a player strip. Sits inside the strip, so nothing moves and the board stays clear. */
export function ChatBubble({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className={styles.bubble} role="status">
      {text}
    </div>
  );
}

/** One fixed-height line under the board: the latest move or event. */
export function MatchTicker({ line, onOpen }: { line: string; onOpen: () => void }) {
  return (
    <button type="button" className={styles.ticker} onClick={onOpen} aria-label={`${line}. Open the match log.`}>
      <span key={line} className={styles.tickerText} aria-live="polite">{line}</span>
    </button>
  );
}

interface MatchDrawerBarProps {
  drawer: MatchDrawerState;
  /** Modifier count, or undefined when this match has no modifier panel. */
  modifierCount?: number;
}

/** The bar pinned to the bottom of the screen. Rides up with the panel when it opens. */
export function MatchDrawerBar({ drawer, modifierCount }: MatchDrawerBarProps) {
  const touchStart = useRef<number | null>(null);
  const { open, tab, unread, select, setOpen } = drawer;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
      <div
        className={`${styles.bar} ${open ? styles.barOpen : ''}`}
        onTouchStart={event => {
          touchStart.current = event.touches[0].clientY;
        }}
        onTouchEnd={event => {
          if (touchStart.current === null) return;
          const moved = event.changedTouches[0].clientY - touchStart.current;
          touchStart.current = null;
          if (moved > 30) setOpen(false);
          else if (moved < -30) setOpen(true);
        }}
      >
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.tabs} role="tablist" aria-label="Match panels">
          <button
            type="button"
            role="tab"
            aria-selected={open && tab === 'feed'}
            aria-expanded={open && tab === 'feed'}
            className={`${styles.tab} ${open && tab === 'feed' ? styles.tabOn : ''}`}
            onClick={() => select('feed')}
          >
            Moves &amp; Chat
            {unread > 0 && <span className={styles.badge} aria-label={`${unread} unread`}>{unread}</span>}
          </button>
          {modifierCount !== undefined && (
            <button
              type="button"
              role="tab"
              aria-selected={open && tab === 'modifiers'}
              aria-expanded={open && tab === 'modifiers'}
              className={`${styles.tab} ${open && tab === 'modifiers' ? styles.tabOn : ''}`}
              onClick={() => select('modifiers')}
            >
              Modifiers ({modifierCount})
            </button>
          )}
        </div>
      </div>
    </>
  );
}
