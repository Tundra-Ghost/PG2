import { useState } from 'react';
import type { GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import styles from './App.module.css';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );

  function handleNewGame() {
    setGameState(chessEngine.getInitialState());
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.logo}>🐦</span>
        <span className={styles.title}>Pigeon Chess</span>
        <span className={styles.phase}>Phase 0</span>
      </header>

      <main className={styles.main}>
        <div className={styles.gameArea}>
          <Board state={gameState} onStateChange={setGameState} />
          <GameStatus state={gameState} onNewGame={handleNewGame} />
        </div>
      </main>
    </div>
  );
}
