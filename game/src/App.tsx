import { useEffect, useState } from 'react';
import type { GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import { getChickBotMove } from './engine/bot';
import { unlockBgm, playMenuBgm, playGameBgm } from './sound';
import type { AppSettings } from './settings';
import { loadSettings, applySettings } from './settings';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import MoveHistory from './components/MoveHistory/MoveHistory';
import MainMenu from './components/MainMenu/MainMenu';
import DraftScreen from './components/DraftScreen/DraftScreen';
import BotSelect from './components/BotSelect/BotSelect';
import type { BotId } from './components/BotSelect/BotSelect';
import SettingsScreen from './components/Settings/Settings';
import styles from './App.module.css';

// Register all modifier definitions (side-effect import)
import './modifiers/index';

type Screen = 'menu' | 'botselect' | 'draft' | 'game' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );
  const [vsBot, setVsBot] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = loadSettings();
    applySettings(s); // sync sound + CSS classes at startup
    return s;
  });

  // BGM: switch track when screen changes
  useEffect(() => {
    if (screen === 'game') {
      playGameBgm();
    } else {
      playMenuBgm();
    }
  }, [screen]);

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

  function goToSettings() {
    setPrevScreen(screen);
    setScreen('settings');
  }

  function handleMenuPlay(mode: 'run' | 'quick') {
    if (mode === 'run') {
      setVsBot(false);
      setScreen('draft');
    } else {
      setScreen('botselect');
    }
  }

  function handleBotSelect(_botId: BotId) {
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

  function handleSettingsSave(s: AppSettings) {
    setSettings(s);
  }

  // Unlock BGM on any first click anywhere in the app (browser autoplay policy)
  const handleUnlock = () => unlockBgm();

  // Settings renders as an overlay on top of the current screen
  const settingsOverlay = screen === 'settings' ? (
    <SettingsScreen
      settings={settings}
      onSave={handleSettingsSave}
      onBack={() => setScreen(prevScreen)}
    />
  ) : null;

  const baseScreen = screen === 'settings' ? prevScreen : screen;

  if (baseScreen === 'menu') {
    return (
      <div onClick={handleUnlock}>
        <MainMenu onPlay={handleMenuPlay} onSettings={goToSettings} />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'botselect') {
    return (
      <div onClick={handleUnlock}>
        <BotSelect
          onSelect={handleBotSelect}
          onBack={() => setScreen('menu')}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'draft') {
    return (
      <div onClick={handleUnlock}>
        <DraftScreen
          onStartMatch={handleStartMatch}
          onBack={() => setScreen('menu')}
        />
        {settingsOverlay}
      </div>
    );
  }

  return (
    <div className={styles.app} onClick={handleUnlock}>
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={handleBackToMenu}>
          ← Menu
        </button>
        <span className={styles.logo}>🐦</span>
        <span className={styles.title}>Pigeon Chess</span>
        <span className={styles.phase}>Phase 0</span>
        <button className={styles.settingsBtn} onClick={goToSettings}>
          ⚙
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.gameArea}>
          <div className={styles.boardColumn}>
            <Board
              state={gameState}
              onStateChange={setGameState}
              showLegalMoves={settings.showLegalMoves}
              autoQueen={settings.autoQueen}
              showCoordinates={settings.showCoordinates}
            />
            <GameStatus state={gameState} onNewGame={handleNewGame} />
          </div>
          <MoveHistory state={gameState} />
        </div>
      </main>

      {settingsOverlay}
    </div>
  );
}
