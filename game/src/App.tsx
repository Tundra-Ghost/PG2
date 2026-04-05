import { useCallback, useEffect, useRef, useState } from 'react';
import type { BerserkerChainEvent, GameState } from './engine/types';
import { chessEngine } from './engine/ChessEngine';
import { getChickBotMove } from './engine/bot';
import { getBotReaction, getBotSpeaker } from './botChat';
import { getBotProfile, type BotId } from './opponents';
import { unlockBgm, playClick, playGameBgm, playMenuBgm } from './sound';
import type { AppSettings } from './settings';
import { applySettings, loadSettings } from './settings';
import Board from './components/Board/Board';
import BotSelect from './components/BotSelect/BotSelect';
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

export interface MatchChatEntry {
  id: string;
  order: number;
  ply: number;
  author: string;
  text: string;
  source: 'player' | 'bot';
  avatarLabel: string;
  avatarIcon?: string | null;
  portraitSrc?: string | null;
  portraitSlotLabel?: string;
  dialogueTheme?: 'player' | 'chick' | 'measured' | 'grandmaster' | 'npc';
  dialogueExpression?: 'neutral' | 'shocked' | 'smug' | 'frustrated';
  shownInDialogue?: boolean;
}

const BERSERKER_ID = 'MOD-E006';

function getDerivedFeedOrder(state: GameState, chatEntries: MatchChatEntry[]): number {
  const moveOrder = state.moveHistory.length * 100;
  const eventOrder = state.eventHistory.reduce(
    (max, event) => Math.max(max, event.ply * 100 + 50),
    0,
  );
  const chatOrder = chatEntries.reduce((max, entry) => Math.max(max, entry.order), 0);
  return Math.max(moveOrder, eventOrder, chatOrder);
}

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
  const bot = getBotProfile(botId);
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
  const [chatEntries, setChatEntries] = useState<MatchChatEntry[]>([]);
  const [dialogueQueue, setDialogueQueue] = useState<MatchChatEntry[]>([]);
  const [pendingDialogue, setPendingDialogue] = useState<MatchChatEntry | null>(null);
  // Stable ref so handleDialogueDismiss never changes identity (avoids resetting DialogueBox timers)
  const pendingDialogueRef = useRef<MatchChatEntry | null>(null);
  useEffect(() => {
    pendingDialogueRef.current = pendingDialogue;
  }, [pendingDialogue]);
  const seenBerserkerEvent = useRef(0);
  const recordedStartIds = useRef<Set<string>>(new Set());
  const recordedCompletionIds = useRef<Set<string>>(new Set());
  const lastReactedMoveId = useRef<string | null>(null);
  // Pop the next queued entry into the DialogueBox when the previous one is dismissed
  useEffect(() => {
    if (pendingDialogue !== null) return;
    if (dialogueQueue.length === 0) return;
    const [next, ...rest] = dialogueQueue;
    setPendingDialogue(next);
    setDialogueQueue(rest);
  }, [pendingDialogue, dialogueQueue]);

  // Stable dismiss — reads entry from ref so it never changes identity across renders
  const handleDialogueDismiss = useCallback(() => {
    const entry = pendingDialogueRef.current;
    if (!entry) return;
    setChatEntries(prev => [...prev, { ...entry, shownInDialogue: true }]);
    setPendingDialogue(null);
  }, []);

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
    if (!selectedBot) return;
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
    if (!vsBot || !selectedBot) return;
    if (screen !== 'game') return;

    const latestMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!latestMove) return;
    const moveKey = `${gameState.id}:${gameState.moveHistory.length}`;
    if (lastReactedMoveId.current === moveKey) return;

    const currentSpeaker = getBotSpeaker(selectedBot);
    const currentOpponentName = currentSpeaker?.name ?? 'Opponent';
    const currentOpponentIcon = currentSpeaker?.icon ?? null;

    const moveIndex = gameState.moveHistory.length - 1;
    const reaction = getBotReaction({
      speakerId: selectedBot,
      moveRecord: latestMove,
      moveIndex,
      gameStatus: gameState.status,
    });

    lastReactedMoveId.current = moveKey;
    if (!reaction) return;

    setDialogueQueue(prev => [
      ...prev,
      {
        id: `chat-${moveKey}`,
        order: getDerivedFeedOrder(gameState, prev) + 1,
        ply: gameState.moveHistory.length,
        author: currentOpponentName,
        text: reaction.text,
        source: 'bot',
        avatarLabel: currentOpponentName.slice(0, 1).toUpperCase(),
        avatarIcon: currentOpponentIcon,
        portraitSlotLabel: currentSpeaker?.portraitSlotLabel ?? `${currentOpponentName} Portrait`,
        dialogueTheme: currentSpeaker?.dialogueTheme ?? 'npc',
        dialogueExpression: reaction.expression,
      },
    ]);
  }, [gameState, screen, selectedBot, vsBot]);

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
      opponentName: getBotSpeaker(selectedBot)?.name ?? 'Opponent',
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
      opponentName: getBotSpeaker(selectedBot)?.name ?? 'Opponent',
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
    playClick();
    setPrevScreen(screen);
    setScreen('settings');
  }

  function goToProfile() {
    playClick();
    setScreen('profile');
  }

  function goToRoost() {
    playClick();
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
    playClick();
    setSelectedBot(botId);
    setVsBot(true);

    if (botSelectMode === 'run') {
      setPendingBotModifierIds([]);
      setScreen('draft');
      return;
    }

    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setActivePlayerModifierIds([]);
    setChatEntries([]);
    setDialogueQueue([]);
    setPendingDialogue(null);
    lastReactedMoveId.current = null;
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
    setChatEntries([]);
    setDialogueQueue([]);
    setPendingDialogue(null);
    lastReactedMoveId.current = null;
    setGameState(state);
    setScreen('game');
  }

  function handleNewGame() {
    playClick();
    commitAbandonmentIfNeeded();
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    setActivePlayerModifierIds([]);
    setPendingBotModifierIds([]);
    setCurrentMatchStartedAt(new Date().toISOString());
    setChatEntries([]);
    setDialogueQueue([]);
    setPendingDialogue(null);
    lastReactedMoveId.current = null;
    setGameState(state);
  }

  function handleSendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setDialogueQueue(prev => [
      ...prev,
      {
        id: `chat-player-${Date.now()}`,
        order: getDerivedFeedOrder(gameState, prev) + 1,
        ply: Math.max(0, gameState.moveHistory.length),
        author: playerName,
        text: trimmed,
        source: 'player',
        avatarLabel: playerName.slice(0, 1).toUpperCase(),
        portraitSrc: playerProfile?.avatarDataUrl ?? null,
        portraitSlotLabel: `${playerName} Portrait`,
        dialogueTheme: 'player',
        dialogueExpression: 'neutral',
      },
    ]);
  }

  function handleBackToMenu() {
    playClick();
    if (screen === 'game') commitAbandonmentIfNeeded();
    setScreen('menu');
  }

  function handleSettingsSave(nextSettings: AppSettings) {
    setSettings(nextSettings);
  }

  const handleUnlock = () => unlockBgm();
  const selectedBotProfile = getBotSpeaker(selectedBot);
  const opponentName = selectedBotProfile?.name ?? 'Opponent';
  const opponentTagline = selectedBotProfile?.tagline ?? 'Awaiting challenger';
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
              portraitLabel={selectedBotProfile?.icon ?? selectedBotProfile?.name.slice(0, 1).toUpperCase() ?? 'O'}
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
            <div className={styles.logDock}>
              <MoveHistory
                state={gameState}
                whiteLabel={playerName}
                blackLabel={vsBot ? opponentName : 'Black'}
                chatEntries={chatEntries}
                onSendChat={gameState.status === 'active' ? handleSendChat : undefined}
                playerAvatarLabel={playerName.slice(0, 1).toUpperCase()}
                playerAvatarSrc={playerProfile?.avatarDataUrl ?? null}
                opponentAvatarIcon={selectedBotProfile?.icon ?? null}
                pendingDialogue={pendingDialogue}
                onDismissDialogue={handleDialogueDismiss}
              />
            </div>

            <div className={styles.boardOnly}>
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

          <div className={styles.gameFooter}>
            <GameStatus
              state={gameState}
              onNewGame={handleNewGame}
              infoMessage={infoMessage}
            />
          </div>
        </section>
      </main>

      {settingsOverlay}
      {viewedProfileOverlay}
    </div>
  );
}
