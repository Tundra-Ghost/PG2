import { useEffect, useRef, useState } from 'react';
import type { GameState, Move } from '@pigeon-chess/game-core';
import { SPEEDRUN_SECONDS, speedrunTimeoutMove } from '@pigeon-chess/game-core';
import styles from './SpeedrunTimer.module.css';

interface SpeedrunTimerProps {
  state: GameState;
  /** True on a turn the clock runs for (the owner to move). Otherwise it waits, full. */
  active: boolean;
  /** True while any popup is open: the clock stops. */
  paused: boolean;
  /** Plays the seeded random move when the clock runs out. */
  onTimeout: (move: Move, from: GameState) => void;
}

const TICK_MS = 100;
const STORE_KEY = 'pigeon-chess-speedrun';

/** Time left saved per turn, so leaving, resuming or reloading never refills the clock. */
function readLeft(turnKey: string): number | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null') as { key: string; left: number } | null;
    return saved?.key === turnKey && typeof saved.left === 'number' ? saved.left : null;
  } catch {
    return null;
  }
}

function writeLeft(turnKey: string, left: number): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ key: turnKey, left }));
  } catch {
    // Storage blocked: a reload starts the clock again.
  }
}

/**
 * MOD-B009 Speedrun Any%: 15 seconds for each move. Shown for the whole match
 * so the board never jumps; it counts only while `active`. It starts again
 * from 15 for each new turn, and holds while a popup is open or the tab is hidden.
 */
export default function SpeedrunTimer({ state, active, paused, onTimeout }: SpeedrunTimerProps) {
  const total = SPEEDRUN_SECONDS * 1000;
  const turnKey = `${state.id}:${state.turnNumber}:${state.moveHistory.length}`;
  // The time left and the turn it belongs to, so a new turn never inherits an old value.
  const [clock, setClock] = useState(() => ({ key: turnKey, left: readLeft(turnKey) ?? total }));
  const left = clock.key === turnKey ? clock.left : (readLeft(turnKey) ?? total);
  const setLeft = (update: (prev: number) => number) =>
    setClock(prev => ({ key: prev.key, left: update(prev.left) }));
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const fired = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    setClock(prev => (prev.key === turnKey ? prev : { key: turnKey, left: readLeft(turnKey) ?? total }));
    fired.current = false;
  }, [turnKey, total]);

  useEffect(() => {
    if (active && clock.key === turnKey) writeLeft(turnKey, clock.left);
  }, [active, turnKey, clock]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const running = active && !paused && !hidden;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const step = now - last;
      last = now;
      setLeft(prev => Math.max(0, prev - step));
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
      // Count the part of a tick that ran before the pause, so pausing never adds time.
      const rest = performance.now() - last;
      setLeft(prev => Math.max(0, prev - rest));
    };
  }, [running, turnKey]);

  useEffect(() => {
    if (clock.key !== turnKey || left > 0 || fired.current || !active) return;
    fired.current = true;
    const move = speedrunTimeoutMove(stateRef.current);
    if (move) timeoutRef.current(move, stateRef.current);
  }, [left, active, clock.key, turnKey]);

  const seconds = Math.ceil(left / 1000);
  const urgent = active && seconds <= 5;
  return (
    <div
      className={`${styles.timer} ${urgent ? styles.urgent : ''}`}
      role="timer"
      aria-live="off"
      aria-label={active ? `Speedrun: ${seconds} seconds left${running ? '' : ', paused'}` : 'Speedrun: waiting for your move'}
    >
      <span className={styles.label}>Speedrun</span>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <span className={styles.seconds} aria-hidden="true">
        {!active ? 'waiting' : running ? `${seconds}s` : `${seconds}s paused`}
      </span>
    </div>
  );
}
