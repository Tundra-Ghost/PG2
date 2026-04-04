import { useEffect, useRef, useState } from 'react';
import type { BerserkerChainEvent, GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import { getChickBotMove } from './engine/bot';
import { unlockBgm, playGameBgm, playMenuBgm } from './sound';
import type { AppSettings } from './settings';
import { applySettings, loadSettings } from './settings';
import Board from './components/Board/Board';
import BotSelect, { BOTS, type BotId } from './components/BotSelect/BotSelect';
import DraftScreen from './components/DraftScreen/DraftScreen';
import GameStatus from './components/GameStatus/GameStatus';
import MainMenu from './components/MainMenu/MainMenu';
import ModifierPanel from './components/ModifierPanel/ModifierPanel';
import MoveHistory from './components/MoveHistory/MoveHistory';
import SettingsScreen from './components/Settings/Settings';
import styles from './App.module.css';
import { ALL_MODIFIERS } from './modifiers/data';
import { modifierRegistry } from './modifiers/registry';

import './modifiers/index';

type Screen = 'menu' | 'botselect' | 'draft' | 'game' | 'settings';
type BotSelectMode = 'run' | 'quick' | null;

const BERSERKER_ID = 'MOD-E006';
const DRAFT_BUDGET = 8;
const DRAFT_MAX_COUNT = 5;
const DRAFT_MAX_PER_CATEGORY = 2;

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

function buildChickDraft(): string[] {
  const implementedIds = new Set(modifierRegistry.getAll().map(mod => mod.id));
  const implementedCards = ALL_MODIFIERS.filter(mod => implementedIds.has(mod.id));
  const shuffled = [...implementedCards].sort(() => Math.random() - 0.5);

  const picks: string[] = [];
  const categoryCounts: Record<string, number> = {};
  let totalCost = 0;

  for (const mod of shuffled) {
    if (picks.length >= DRAFT_MAX_COUNT) break;
    if ((categoryCounts[mod.category] ?? 0) >= DRAFT_MAX_PER_CATEGORY) continue;
    if (totalCost + mod.cost > DRAFT_BUDGET) continue;

    picks.push(mod.id);
    totalCost += mod.cost;
    categoryCounts[mod.category] = (categoryCounts[mod.category] ?? 0) + 1;
  }

  return picks;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() =>
    chessEngine.getInitialState(),
  );
  const [vsBot, setVsBot] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotId | null>(null);
  const [botSelectMode, setBotSelectMode] = useState<BotSelectMode>(null);
  const [pendingBotModifierIds, setPendingBotModifierIds] = useState<string[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [modifierPanelCollapsed, setModifierPanelCollapsed] = useState(false);
  const seenBerserkerEvent = useRef(0);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    applySettings(loaded);
    return loaded;
  });

  useEffect(() => {
    if (screen === 'game') {
      playGameBgm();
    } else {
      playMenuBgm();
    }
  }, [screen]);

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
    setVsBot(false);
    setSelectedBot(null);
    setPendingBotModifierIds([]);
    setBotSelectMode(mode);
    setScreen('botselect');
  }

  function handleBotSelect(botId: BotId) {
    setSelectedBot(botId);
    setVsBot(true);

    if (botSelectMode === 'run') {
      setPendingBotModifierIds(botId === 'chick' ? buildChickDraft() : []);
      setScreen('draft');
      return;
    }

    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setGameState(state);
    setScreen('game');
  }

  function handleStartMatch(playerModifierIds: string[]) {
    let state = chessEngine.getInitialState();
    state = chessEngine.activateDraftModifiers(state, [
      ...playerModifierIds.map(id => ({ id, sourceColor: 'white' as const })),
      ...pendingBotModifierIds.map(id => ({ id, sourceColor: 'black' as const })),
    ]);
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

  function handleSettingsSave(nextSettings: AppSettings) {
    setSettings(nextSettings);
  }

  const handleUnlock = () => unlockBgm();

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
    const botSelectSubtitle = botSelectMode === 'run'
      ? 'New Run · Choose bot opponent before drafting modifiers'
      : 'Quick Play · Standard chess · No modifiers';

    return (
      <div onClick={handleUnlock}>
        <BotSelect
          onSelect={handleBotSelect}
          onBack={() => setScreen('menu')}
          subtitle={botSelectSubtitle}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'draft') {
    const opponentName = BOTS.find(bot => bot.id === selectedBot)?.name ?? 'Opponent';

    return (
      <div onClick={handleUnlock}>
        <DraftScreen
          onStartMatch={handleStartMatch}
          onBack={() => setScreen('botselect')}
          opponentName={opponentName}
          opponentModifierIds={pendingBotModifierIds}
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
            <MoveHistory
              state={gameState}
              whiteLabel="You"
              blackLabel={
                vsBot
                  ? (BOTS.find(bot => bot.id === selectedBot)?.name ?? 'Opponent')
                  : 'Black'
              }
            />
          </div>

          <div
            className={`${styles.sideColumn} ${
              modifierPanelCollapsed ? styles.sideColumnCollapsed : ''
            }`}
          >
            <ModifierPanel
              state={gameState}
              collapsed={modifierPanelCollapsed}
              playerLabel="Your Draft"
              opponentLabel={
                selectedBot
                  ? `${BOTS.find(bot => bot.id === selectedBot)?.name ?? 'Opponent'} Draft`
                  : 'Opponent Draft'
              }
              onToggleCollapsed={() => setModifierPanelCollapsed(prev => !prev)}
            />
          </div>
        </div>
      </main>

      {settingsOverlay}
    </div>
  );
}
