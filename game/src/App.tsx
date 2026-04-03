import { useState } from 'react';
import type { GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import MoveHistory from './components/MoveHistory/MoveHistory';
import MainMenu from './components/MainMenu/MainMenu';
import DraftScreen from './components/DraftScreen/DraftScreen';
import styles from './App.module.css';

type Screen = 'menu' | 'draft' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );

  function handleMenuPlay(mode: 'run' | 'quick') {
    if (mode === 'run') {
      setScreen('draft');
    } else {
      setGameState(chessEngine.getInitialState());
      setScreen('game');
    }
  }

  function handleStartMatch(_selectedIds: string[]) {
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
    return <MainMenu onPlay={handleMenuPlay} />;
  }

  if (screen === 'draft') {
    return (
      <DraftScreen
        onStartMatch={handleStartMatch}
        onBack={() => setScreen('menu')}
      />
    );
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
          {/* Board + status bar */}
          <div className={styles.boardColumn}>
            <Board state={gameState} onStateChange={setGameState} />
            <GameStatus state={gameState} onNewGame={handleNewGame} />
          </div>

          {/* Move history panel */}
          <MoveHistory state={gameState} />
        </div>
      </main>
    </div>
  );
}
