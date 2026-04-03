import { useState } from 'react';
import type { GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import MainMenu from './components/MainMenu/MainMenu';
import styles from './App.module.css';

type Screen = 'menu' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );

  function handlePlay(_mode: 'run' | 'quick') {
    setGameState(chessEngine.getInitialState());
    setScreen('game');
  }

  function handleNewGame() {
    setGameState(chessEngine.getInitialState());
  }

  function handleBackToMenu() {
    setScreen('menu');
  }

  if (screen === 'menu') {
    return <MainMenu onPlay={handlePlay} />;
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={handleBackToMenu}>
          ← Menu
        </button>
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
