import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { SquareView } from '../Board/boardView';
import { BoardScene, CELL } from './BoardScene';
import styles from './PhaserBoard.module.css';

interface PhaserBoardProps {
  views: SquareView[];
}

/**
 * Hosts the Phaser board scene inside the React board frame. It only draws:
 * clicks, tooltips and screen-reader labels come from the hit squares React
 * lays over it.
 */
export default function PhaserBoard({ views }: PhaserBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const latestViews = useRef(views);
  latestViews.current = views;

  useEffect(() => {
    if (!hostRef.current) return;
    const scene = new BoardScene();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: CELL * 8,
      height: CELL * 8,
      transparent: true,
      banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    });
    sceneRef.current = scene;
    scene.setBoard(latestViews.current);
    return () => {
      sceneRef.current = null;
      // Phaser removes its canvas on its next frame; take it out now so a
      // quick remount (React StrictMode) never shows two boards.
      game.canvas?.remove();
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setBoard(views);
  }, [views]);

  return <div ref={hostRef} className={styles.host} data-board-renderer="phaser" aria-hidden="true" />;
}
