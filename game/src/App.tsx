import { useEffect, useState } from 'react';
import type { GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import { getChickBotMove } from './engine/bot';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import MoveHistory from './components/MoveHistory/MoveHistory';
import MainMenu from './components/MainMenu/MainMenu';
import DraftScreen from './components/DraftScreen/DraftScreen';
import BotSelect from './components/BotSelect/BotSelect';
import type { BotId } from './components/BotSelect/BotSelect';
import styles from './App.module.css';

// Register all modifier definitions (side-effect import)
import './modifiers/index';

type Screen = 'menu' | 'botselect' | 'draft' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );
  const [vsBot, setVsBot] = useState(false);

  // Chick bot: fires when it's black's turn and vsBot is active
  useEffect(() => {
    if (!vsBot) return;
    if (gameState.status !== 'active') return;
    if (gameState.turn !== 'black') return;

    const timer = setTimeout(() => {
      const move = getChickBotMove(gameState, 'black');
      if (move) {
        setGameState(prev =>
          prev.status === 'active' ? chessEngine.applyMove(prev, move) : prev,
        );
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [vsBot, gameState]);

  function handleMenuPlay(mode: 'run' | 'quick') {
    if (mode === 'run') {
      setVsBot(false);
      setScreen('draft');
    } else {
      setScreen('botselect');
    }
  }

  function handleBotSelect(_botId: BotId) {
    // All bots currently route through Chick — swap implementation per botId later
    setVsBot(true);
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setGameState(state);
    setScreen('game');
  }

  function handleStartMatch(selectedIds: string[]) {
    setVsBot(false);
    let state = chessEngine.getInitialState();
    state = chessEngine.activateModifiers(state, selectedIds);
    state = chessEngine.beginTurn(state);
    setGameState(state);
    setScreen('game');
  }

  function handleNewGame() {
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setGameState(state);
  }

  function handleBackToMenu() {
    setScreen('menu');
  }

  if (screen === 'menu') {
    return <MainMenu onPlay={handleMenuPlay} />;
  }

  if (screen === 'botselect') {
    return (
      <BotSelect
        onSelect={handleBotSelect}
        onBack={() => setScreen('menu')}
      />
    );
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
