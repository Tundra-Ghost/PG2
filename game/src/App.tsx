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
import PlayerBanner from './components/PlayerBanner/PlayerBanner';
import ProfileSetup from './components/ProfileSetup/ProfileSetup';
import SettingsScreen from './components/Settings/Settings';
import {
  createProfile,
  getProfileLevel,
  getSelectedTitle,
  loadProfile,
  recordProfileMatchCompletion,
  recordProfileMatchStart,
  type LocalProfile,
  type MatchMode,
} from './profile';
import styles from './App.module.css';

import './modifiers/index';

type Screen = 'menu' | 'botselect' | 'draft' | 'game' | 'settings' | 'profile' | 'roost';
type BotSelectMode = 'run' | 'quick' | null;

interface ProfileViewerState {
  profile: LocalProfile;
  editable: boolean;
  heading: string;
  subtitle: string;
}

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

function buildBotProfile(botId: BotId | null): LocalProfile | null {
  const bot = botId ? (BOTS.find(entry => entry.id === botId) ?? null) : null;
  if (!bot) return null;

  const base = createProfile({
    displayName: bot.name,
    motto: bot.description,
    region: 'Local Bot Pool',
    country: 'Prototype',
    avatarDataUrl: null,
    selectedTitleId: bot.id === 'chick' ? 'title_bread_bandit' : 'title_rookery_scout',
  });

  return {
    ...base,
    elo: 1200,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    stats: {
      modes: {
        story: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
        quick: {
          gamesPlayed: bot.difficulty * 6,
          wins: bot.difficulty * 2,
          losses: bot.difficulty * 3,
          draws: bot.difficulty,
        },
        online: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
      },
    },
    unlockedAchievements: {
      ach_first_flight: '2026-01-02T00:00:00.000Z',
    },
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() => chessEngine.getInitialState());
  const [vsBot, setVsBot] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotId | null>(null);
  const [botSelectMode, setBotSelectMode] = useState<BotSelectMode>(null);
  const [activePlayerModifierIds, setActivePlayerModifierIds] = useState<string[]>([]);
  const [pendingBotModifierIds, setPendingBotModifierIds] = useState<string[]>([]);
  const [currentMatchMode, setCurrentMatchMode] = useState<MatchMode>('quick');
  const [currentMatchStartedAt, setCurrentMatchStartedAt] = useState<string>(
    new Date().toISOString(),
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [modifierPanelCollapsed, setModifierPanelCollapsed] = useState(false);
  const [profileViewer, setProfileViewer] = useState<ProfileViewerState | null>(null);
  const seenBerserkerEvent = useRef(0);
  const recordedStartIds = useRef<Set<string>>(new Set());
  const recordedCompletionIds = useRef<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    applySettings(loaded);
    return loaded;
  });
  const [profile, setProfile] = useState<LocalProfile | null>(() => loadProfile());

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
        setGameState(prev => (prev.status === 'active' ? chessEngine.applyMove(prev, move) : prev));
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
    setInfoMessage(`BOY chained into${pieceLabel} on ${event.to}.`);
    seenBerserkerEvent.current = event.counter;
  }, [gameState]);

  useEffect(() => {
    if (screen !== 'game') return;
    if (!profile) return;
    if (recordedStartIds.current.has(gameState.id)) return;

    const nextProfile = recordProfileMatchStart(profile, currentMatchMode);
    recordedStartIds.current.add(gameState.id);
    setProfile(nextProfile);
  }, [screen, profile, gameState.id, currentMatchMode]);

  useEffect(() => {
    if (!profile) return;
    if (gameState.status !== 'checkmate' && gameState.status !== 'draw') return;
    if (recordedCompletionIds.current.has(gameState.id)) return;

    const result =
      gameState.status === 'draw' ? 'draw' : gameState.turn === 'black' ? 'win' : 'loss';

    const nextProfile = recordProfileMatchCompletion(profile, {
      matchId: gameState.id,
      playedAt: currentMatchStartedAt,
      mode: currentMatchMode,
      opponentName: selectedBot ? (BOTS.find(bot => bot.id === selectedBot)?.name ?? 'Opponent') : 'Opponent',
      opponentType: vsBot ? 'bot' : 'player',
      result,
      outcome: gameState.status === 'draw' ? 'draw' : 'checkmate',
      moveCount: gameState.moveHistory.length,
      draftedModifierIds: activePlayerModifierIds,
    });

    recordedCompletionIds.current.add(gameState.id);
    setProfile(nextProfile);
  }, [
    profile,
    gameState.status,
    gameState.turn,
    gameState.id,
    gameState.moveHistory.length,
    currentMatchStartedAt,
    currentMatchMode,
    selectedBot,
    vsBot,
    activePlayerModifierIds,
  ]);

  function commitAbandonmentIfNeeded() {
    if (!profile) return;
    if (gameState.status !== 'active') return;
    if (gameState.moveHistory.length === 0) return;
    if (recordedCompletionIds.current.has(gameState.id)) return;

    const nextProfile = recordProfileMatchCompletion(profile, {
      matchId: gameState.id,
      playedAt: currentMatchStartedAt,
      mode: currentMatchMode,
      opponentName: selectedBot ? (BOTS.find(bot => bot.id === selectedBot)?.name ?? 'Opponent') : 'Opponent',
      opponentType: vsBot ? 'bot' : 'player',
      result: 'loss',
      outcome: 'abandoned',
      moveCount: gameState.moveHistory.length,
      draftedModifierIds: activePlayerModifierIds,
    });

    recordedCompletionIds.current.add(gameState.id);
    setProfile(nextProfile);
  }

  function goToSettings() {
    setPrevScreen(screen);
    setScreen('settings');
  }

  function goToProfile() {
    setScreen('profile');
  }

  function goToRoost() {
    setScreen('roost');
  }

  function handleMenuPlay(mode: 'run' | 'quick') {
    setVsBot(false);
    setSelectedBot(null);
    setPendingBotModifierIds([]);
    setActivePlayerModifierIds([]);
    setBotSelectMode(mode);
    setCurrentMatchMode(mode === 'run' ? 'story' : 'quick');
    setScreen('botselect');
  }

  function handleBotSelect(botId: BotId) {
    setSelectedBot(botId);
    setVsBot(true);

    if (botSelectMode === 'run') {
      setPendingBotModifierIds([]);
      setScreen('draft');
      return;
    }

    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setActivePlayerModifierIds([]);
    setCurrentMatchMode('quick');
    setCurrentMatchStartedAt(new Date().toISOString());
    setGameState(state);
    setScreen('game');
  }

  function handleStartMatch(playerModifierIds: string[], opponentModifierIds: string[]) {
    let state = chessEngine.getInitialState();
    state = chessEngine.activateDraftModifiers(state, [
      ...playerModifierIds.map(id => ({ id, sourceColor: 'white' as const })),
      ...opponentModifierIds.map(id => ({ id, sourceColor: 'black' as const })),
    ]);
    state = chessEngine.beginTurn(state);
    setPendingBotModifierIds(opponentModifierIds);
    setActivePlayerModifierIds(playerModifierIds);
    setCurrentMatchMode('story');
    setCurrentMatchStartedAt(new Date().toISOString());
    setGameState(state);
    setScreen('game');
  }

  function handleNewGame() {
    commitAbandonmentIfNeeded();
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setActivePlayerModifierIds([]);
    setPendingBotModifierIds([]);
    setCurrentMatchStartedAt(new Date().toISOString());
    setGameState(state);
  }

  function handleBackToMenu() {
    if (screen === 'game') commitAbandonmentIfNeeded();
    setScreen('menu');
  }

  function handleSettingsSave(nextSettings: AppSettings) {
    setSettings(nextSettings);
  }

  const handleUnlock = () => unlockBgm();
  const selectedBotMeta = selectedBot ? (BOTS.find(bot => bot.id === selectedBot) ?? null) : null;
  const opponentName = selectedBotMeta?.name ?? 'Opponent';
  const opponentTagline = selectedBotMeta?.tagline ?? 'Awaiting challenger';
  const moveCountLabel =
    gameState.moveHistory.length > 0 ? `Move ${gameState.flags.fullMoveNumber}` : 'Opening position';
  const botProfile = buildBotProfile(selectedBot);
  const playerProfile = profile;
  const playerName = playerProfile?.displayName ?? 'Player';
  const playerTitle = playerProfile ? getSelectedTitle(playerProfile).name : 'Street Pigeon';
  const playerLevel = playerProfile ? getProfileLevel(playerProfile) : 1;
  const opponentLevel = botProfile ? getProfileLevel(botProfile) : 1;
  const opponentTitle = botProfile ? getSelectedTitle(botProfile).name : 'Street Pigeon';

  const settingsOverlay =
    screen === 'settings' ? (
      <SettingsScreen
        settings={settings}
        onSave={handleSettingsSave}
        onBack={() => setScreen(prevScreen)}
      />
    ) : null;

  const viewedProfileOverlay = profileViewer ? (
    <ProfileSetup
      profile={profileViewer.profile}
      editable={profileViewer.editable}
      heading={profileViewer.heading}
      subtitle={profileViewer.subtitle}
      onBack={() => setProfileViewer(null)}
    />
  ) : null;

  const baseScreen = screen === 'settings' ? prevScreen : screen;

  if (baseScreen === 'menu') {
    return (
      <div onClick={handleUnlock}>
        <MainMenu
          onPlay={handleMenuPlay}
          onSettings={goToSettings}
          onProfile={goToProfile}
          onRoost={goToRoost}
          profile={profile}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'profile') {
    return (
      <div onClick={handleUnlock}>
        <ProfileSetup
          profile={profile}
          editable
          onSave={nextProfile => {
            setProfile(nextProfile);
            setScreen('menu');
          }}
          onBack={() => setScreen('menu')}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'roost') {
    return (
      <div onClick={handleUnlock}>
        <ProfileSetup
          profile={
            profile ??
            createProfile({
              displayName: 'Player',
              motto: '',
              region: 'North America',
              country: '',
              avatarDataUrl: null,
              selectedTitleId: 'title_street_pigeon',
            })
          }
          editable={false}
          heading="The Roost"
          subtitle="Local records, titles, achievements, and offline history for the current serverless prototype. Online sections remain placeholder scaffolding."
          onBack={() => setScreen('menu')}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'botselect') {
    const botSelectSubtitle =
      botSelectMode === 'run'
        ? 'New Run - Choose bot opponent before drafting modifiers'
        : 'Quick Play - Standard chess - No modifiers';

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
          Menu
        </button>
        <span className={styles.title}>Pigeon Chess</span>
        <span className={styles.phase}>Phase 0</span>
        <button className={styles.settingsBtn} onClick={goToSettings}>
          Settings
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.matchHud}>
          <div className={styles.bannerRow}>
            <PlayerBanner
              role="Player"
              name={playerName}
              metaLine={`${playerTitle} - Lv ${playerLevel} - ELO ${playerProfile?.elo ?? 1200}`}
              subtitle={playerProfile?.motto || moveCountLabel}
              badge={gameState.turn === 'white' ? 'To Move' : 'Waiting'}
              portraitLabel={playerName.slice(0, 1).toUpperCase()}
              portraitSrc={playerProfile?.avatarDataUrl ?? null}
              onClick={() => {
                if (!playerProfile) return;
                setProfileViewer({
                  profile: playerProfile,
                  editable: false,
                  heading: `${playerName} Profile`,
                  subtitle: 'Read-only in-match profile view.',
                });
              }}
            />
            <PlayerBanner
              role={vsBot ? 'AI' : 'Opponent'}
              name={opponentName}
              metaLine={`${opponentTitle} - Lv ${opponentLevel} - ELO ${botProfile?.elo ?? 1200}`}
              subtitle={botProfile?.motto || opponentTagline}
              badge={gameState.turn === 'black' ? 'To Move' : 'Standing By'}
              portraitLabel={selectedBotMeta?.name.slice(0, 1).toUpperCase() ?? 'O'}
              align="right"
              onClick={() => {
                if (!botProfile) return;
                setProfileViewer({
                  profile: botProfile,
                  editable: false,
                  heading: `${opponentName} Dossier`,
                  subtitle:
                    'Prototype opponent profile view. Online profile exchange is reserved for future server-backed play.',
                });
              }}
            />
          </div>

          <div className={styles.stageRow}>
            <div className={styles.boardStage}>
              <div className={styles.boardShell}>
                <Board
                  state={gameState}
                  onStateChange={setGameState}
                  onInfo={setInfoMessage}
                  showLegalMoves={settings.showLegalMoves}
                  autoQueen={settings.autoQueen}
                  showCoordinates={settings.showCoordinates}
                />
              </div>
              <GameStatus
                state={gameState}
                onNewGame={handleNewGame}
                infoMessage={infoMessage}
              />
            </div>
          </div>

          <div className={styles.bottomDock}>
            <div className={styles.logDock}>
              <MoveHistory
                state={gameState}
                whiteLabel={playerName}
                blackLabel={vsBot ? opponentName : 'Black'}
              />
            </div>

            <div
              className={`${styles.modifierDock} ${
                modifierPanelCollapsed ? styles.modifierDockCollapsed : ''
              }`}
            >
              <ModifierPanel
                state={gameState}
                collapsed={modifierPanelCollapsed}
                playerLabel="Your Draft"
                opponentLabel={selectedBot ? `${opponentName} Draft` : 'Opponent Draft'}
                onToggleCollapsed={() => setModifierPanelCollapsed(prev => !prev)}
              />
            </div>
          </div>
        </section>
      </main>

      {settingsOverlay}
      {viewedProfileOverlay}
    </div>
  );
}
