import { useEffect, useRef, useState } from 'react';
import type { BerserkerChainEvent, GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import { getChickBotMove } from './engine/bot';
import { unlockBgm, playMenuBgm, playGameBgm } from './sound';
import type { AppSettings } from './settings';
import { loadSettings, applySettings } from './settings';
import Board from './components/Board/Board';
import GameStatus from './components/GameStatus/GameStatus';
import ModifierPanel from './components/ModifierPanel/ModifierPanel';
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
const BERSERKER_ID = 'MOD-E006';

function getBerserkerEvent(state: GameState): BerserkerChainEvent | null {
  const value = state.modifierState[BERSERKER_ID];
  if (
    typeof value === 'object' &&
    value !== null &&
    'counter' in value &&
    'from' in value &&
    'to' in value
  ) {
    return value as BerserkerChainEvent;
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );
  const [vsBot, setVsBot] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotId | null>(null);
  const [pendingRunModifiers, setPendingRunModifiers] = useState<string[] | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const seenBerserkerEvent = useRef(0);
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
    if (selectedBot !== 'chick') return;
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
  }, [vsBot, selectedBot, gameState]);

  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => setInfoMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  useEffect(() => {
    if (gameState.moveHistory.length === 0 && gameState.turnNumber === 1) {
      seenBerserkerEvent.current = 0;
      return;
    }

    const event = getBerserkerEvent(gameState);
    if (!event || event.counter <= seenBerserkerEvent.current) return;

    const pieceLabel = event.capturedType ? ` ${event.capturedType}` : '';
    setInfoMessage(`BOY. chained into${pieceLabel} on ${event.to}.`);
    seenBerserkerEvent.current = event.counter;
  }, [gameState]);

  function goToSettings() {
    setPrevScreen(screen);
    setScreen('settings');
  }

  function handleMenuPlay(mode: 'run' | 'quick') {
    if (mode === 'run') {
      setVsBot(false);
      setSelectedBot(null);
      setPendingRunModifiers(null);
      setScreen('draft');
    } else {
      setPendingRunModifiers(null);
      setScreen('botselect');
    }
  }

  function handleBotSelect(botId: BotId) {
    setSelectedBot(botId);
    setVsBot(true);
    let state = chessEngine.getInitialState();
    if (pendingRunModifiers) {
      state = chessEngine.activateModifiers(state, pendingRunModifiers);
    }
    state = chessEngine.beginTurn(state);
    setGameState(state);
    setPendingRunModifiers(null);
    setScreen('game');
  }

  function handleStartMatch(selectedIds: string[]) {
    setPendingRunModifiers(selectedIds);
    setScreen('botselect');
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
    const botSelectSubtitle = pendingRunModifiers
      ? 'New Run · Drafted modifiers active · Choose bot opponent'
      : 'Quick Play · Standard chess · No modifiers';

    return (
      <div onClick={handleUnlock}>
        <BotSelect
          onSelect={handleBotSelect}
          onBack={() => setScreen(pendingRunModifiers ? 'draft' : 'menu')}
          subtitle={botSelectSubtitle}
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
              onInfo={setInfoMessage}
              showLegalMoves={settings.showLegalMoves}
              autoQueen={settings.autoQueen}
              showCoordinates={settings.showCoordinates}
            />
            <GameStatus
              state={gameState}
              onNewGame={handleNewGame}
              infoMessage={infoMessage}
            />
          </div>
          <div className={styles.sideColumn}>
            <ModifierPanel state={gameState} />
            <MoveHistory state={gameState} />
          </div>
        </div>
      </main>

      {settingsOverlay}
    </div>
  );
}
