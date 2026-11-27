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

/**
 * MOD-B009 Speedrun Any%: 15 seconds for each move. Shown for the whole match
 * so the board never jumps; it counts only while `active`. It starts again
 * from 15 for each new turn, and holds while a popup is open or the tab is hidden.
 */
export default function SpeedrunTimer({ state, active, paused, onTimeout }: SpeedrunTimerProps) {
  const total = SPEEDRUN_SECONDS * 1000;
  const turnKey = `${state.id}:${state.turnNumber}:${state.moveHistory.length}`;
  const [left, setLeft] = useState(total);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const fired = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    setLeft(total);
    fired.current = false;
  }, [turnKey, total]);

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
    return () => window.clearInterval(timer);
  }, [running, turnKey]);

  useEffect(() => {
    if (left > 0 || fired.current || !active) return;
    fired.current = true;
    const move = speedrunTimeoutMove(stateRef.current);
    if (move) timeoutRef.current(move, stateRef.current);
  }, [left, active]);

  const seconds = Math.ceil(left / 1000);
  const urgent = active && seconds <= 5;
  return (
    <div className={`${styles.timer} ${urgent ? styles.urgent : ''}`} role="timer" aria-live="off">
      <span className={styles.label}>Speedrun</span>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <span className={styles.seconds} aria-label={active ? `${seconds} seconds left` : 'Not your move'}>
        {!active ? 'waiting' : running ? `${seconds}s` : `${seconds}s paused`}
      </span>
    </div>
  );
}
