import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { Square } from '@pigeon-chess/game-core';
import type { SquareView } from '../Board/boardView';
import { BoardScene, CELL } from './BoardScene';
import styles from './PhaserBoard.module.css';

interface PhaserBoardProps {
  views: SquareView[];
  onSquareClick: (square: Square) => void;
}

/** Hosts the Phaser board scene inside the React board frame. */
export default function PhaserBoard({ views, onSquareClick }: PhaserBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const latest = useRef({ views, onSquareClick });
  latest.current = { views, onSquareClick };

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
    scene.setBoard(latest.current.views, square => latest.current.onSquareClick(square));
    return () => {
      sceneRef.current = null;
      // Phaser removes its canvas on its next frame; take it out now so a
      // quick remount (React StrictMode) never shows two boards.
      game.canvas?.remove();
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setBoard(views, square => latest.current.onSquareClick(square));
  }, [views]);

  return <div ref={hostRef} className={styles.host} data-board-renderer="phaser" />;
}
