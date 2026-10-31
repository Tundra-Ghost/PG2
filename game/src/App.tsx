import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@pigeon-chess/game-core';
import { chessEngine } from '@pigeon-chess/game-core';
import { getBotReaction, getBotSpeaker } from './botChat';
import type { BotId } from './opponents';
import { unlockBgm, playClick, playGameBgm, playMenuBgm } from './sound';
import type { AppSettings } from './settings';
import { applySettings, loadSettings, saveSettings } from './settings';
import { useAccount } from './online/useAccount';
import { useSocial } from './online/useSocial';
import { ChatBubble, MatchDrawerBar, MatchTicker, useMatchDrawer } from './components/MatchDrawer/MatchDrawer';
import Friends from './components/Friends/Friends';
import PostGameSurvey from './components/PostGameSurvey/PostGameSurvey';
import { isFinished, resultFor, type GameSurveyContext } from './online/survey';
import {
  getDerivedFeedOrder,
  getModifierEventBannerMessage,
  pickBannerEvent,
  latestFeedLine,
  type MatchChatEntry,
} from './matchFeed';
import { buildBotProfile } from './matchProfiles';
import Board from './components/Board/Board';
import BotSelect from './components/BotSelect/BotSelect';
import { requestBotMove } from './bot/requestBotMove';
import CollectionVault from './components/CollectionVault/CollectionVault';
import DraftScreen from './components/DraftScreen/DraftScreen';
import GameStatus from './components/GameStatus/GameStatus';
import MainMenu from './components/MainMenu/MainMenu';
import ModifierPanel from './components/ModifierPanel/ModifierPanel';
import MoveHistory from './components/MoveHistory/MoveHistory';
import PlayerBanner from './components/PlayerBanner/PlayerBanner';
import ProfileSetup from './components/ProfileSetup/ProfileSetup';
import SettingsScreen from './components/Settings/Settings';
import OnlineMatch from './components/OnlineMatch/OnlineMatch';
import PuzzleScreen from './components/PuzzleScreen/PuzzleScreen';
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


type Screen =
  | 'menu'
  | 'botselect'
  | 'draft'
  | 'game'
  | 'settings'
  | 'profile'
  | 'roost'
  | 'collection'
  | 'online'
  | 'friends'
  | 'puzzles';
type BotSelectMode = 'run' | 'quick' | 'practice' | null;

interface ProfileViewerState {
  profile: LocalProfile;
  editable: boolean;
  heading: string;
  subtitle: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>(() => chessEngine.getInitialState());
  const [vsBot, setVsBot] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotId | null>(null);
  /** The bot is working out its move. */
  const [botThinking, setBotThinking] = useState(false);
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
  const drawer = useMatchDrawer(chatEntries, pendingDialogue);
  // Stable ref so handleDialogueDismiss never changes identity (avoids resetting DialogueBox timers)
  const pendingDialogueRef = useRef<MatchChatEntry | null>(null);
  useEffect(() => {
    pendingDialogueRef.current = pendingDialogue;
  }, [pendingDialogue]);
  const lastAnnouncedEventId = useRef<string | null>(null);
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
    setChatEntries(prev => [...prev, { ...entry, shownInDialogue: true, spokenLive: true }]);
    setPendingDialogue(null);
  }, []);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    applySettings(loaded);
    return loaded;
  });
  const [profile, setProfile] = useState<LocalProfile | null>(() => loadProfile());
  const account = useAccount(profile, setProfile);
  const social = useSocial(account.account?.username ?? null);
  /** A room the Online screen should sit down in when it opens. */
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const clearPendingRoom = useCallback(() => setPendingRoomId(null), []);
  /** The finished game the debrief is about, while it is open. */
  const [surveyFor, setSurveyFor] = useState<GameSurveyContext | null>(null);
  const surveyedIds = useRef(new Set<string>());

  useEffect(() => {
    // A new screen starts at the top. Without this, mobile kept the draft
    // screen's scroll offset and opened the match with the board off-screen.
    window.scrollTo(0, 0);
  }, [screen]);

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

    let cancelled = false;
    setBotThinking(true);
    const timer = setTimeout(() => {
      void requestBotMove(selectedBot, gameState, 'black').then(move => {
        // The match moved on (resign, menu, new game) while the bot was thinking.
        if (cancelled) return;
        setBotThinking(false);
        if (move) {
          setGameState(prev => (prev === gameState ? chessEngine.applyMove(prev, move) : prev));
        } else if (chessEngine.canShooGerald(gameState)) {
          // Gerald pinned the only movable piece. The bot spends its turn shooing him.
          setGameState(prev => (prev === gameState ? chessEngine.shooGerald(prev) : prev));
        }
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setBotThinking(false);
    };
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
    const currentOpponentIcon = currentSpeaker?.sprite ? null : currentSpeaker?.icon ?? null;

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
        portraitSrc: currentSpeaker?.sprite ?? null,
        portraitSlotLabel: currentSpeaker?.portraitSlotLabel ?? `${currentOpponentName} Portrait`,
        dialogueTheme: currentSpeaker?.dialogueTheme ?? 'npc',
        dialogueExpression: reaction.expression,
      },
    ]);
  }, [gameState, screen, selectedBot, vsBot]);

  useEffect(() => {
    const latestEvent = gameState.eventHistory[gameState.eventHistory.length - 1];
    if (!latestEvent) {
      lastAnnouncedEventId.current = null;
      return;
    }
    if (latestEvent.id === lastAnnouncedEventId.current) return;

    const bannerEvent = pickBannerEvent(gameState.eventHistory, lastAnnouncedEventId.current);
    lastAnnouncedEventId.current = latestEvent.id;
    if (bannerEvent) setInfoMessage(getModifierEventBannerMessage(bannerEvent));
  }, [gameState.eventHistory]);

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

  // Offer the optional debrief shortly after a local game ends, once per game.
  useEffect(() => {
    if (screen !== 'game' || !settings.postGameSurveys) return;
    if (!isFinished(gameState) || surveyedIds.current.has(gameState.id)) return;
    surveyedIds.current.add(gameState.id);
    const context: GameSurveyContext = {
      mode: vsBot ? 'bot' : 'local',
      modifierIds: gameState.activeModifiers.map(mod => mod.id),
      result: resultFor(gameState, 'white'),
      details: {
        matchMode: currentMatchMode,
        bot: vsBot ? selectedBot : null,
        moves: gameState.moveHistory.length,
        ending: gameState.status,
      },
    };
    const timer = setTimeout(() => setSurveyFor(context), 1500);
    return () => clearTimeout(timer);
  }, [screen, settings.postGameSurveys, gameState, vsBot, selectedBot, currentMatchMode]);

  const surveyOverlay = surveyFor ? (
    <PostGameSurvey
      context={surveyFor}
      onClose={() => setSurveyFor(null)}
      onStopAsking={() => {
        const next = { ...settings, postGameSurveys: false };
        saveSettings(next);
        setSettings(next);
      }}
    />
  ) : null;

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

  function goToCollection() {
    playClick();
    setScreen('collection');
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

    if (botSelectMode === 'run' || botSelectMode === 'practice') {
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
    setCurrentMatchMode(botSelectMode === 'practice' ? 'quick' : 'story');
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

  /** Attached to feedback so a report can be reproduced. */
  function feedbackContext(): Record<string, unknown> {
    const inMatch = prevScreen === 'game';
    return {
      screen: prevScreen,
      account: account.account?.username ?? null,
      ...(inMatch
        ? {
            mode: currentMatchMode,
            bot: vsBot ? selectedBot : null,
            modifiers: activePlayerModifierIds,
            moves: gameState.moveHistory.length,
            status: gameState.status,
            turn: gameState.turn,
          }
        : {}),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sentAt: new Date().toISOString(),
    };
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
        account={account}
        feedbackContext={feedbackContext}
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
          onCollection={goToCollection}
          onPuzzles={() => setScreen('puzzles')}
          onOnline={() => {
            playClick();
            setScreen('online');
          }}
          onFriends={() => setScreen('friends')}
          friendsBadge={social.unread + social.list.incoming.length}
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

  if (baseScreen === 'friends') {
    return (
      <div onClick={handleUnlock}>
        <Friends
          account={account.account?.username ?? null}
          social={social}
          onBack={() => setScreen('menu')}
          onSignIn={goToSettings}
          onPlay={roomId => {
            setPendingRoomId(roomId);
            setScreen('online');
          }}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'online') {
    return (
      <div onClick={handleUnlock}>
        <OnlineMatch
          playerName={playerName}
          account={account.account?.username ?? null}
          joinRoomId={pendingRoomId}
          onJoined={clearPendingRoom}
          onStopSurveys={() => {
            const next = { ...settings, postGameSurveys: false };
            saveSettings(next);
            setSettings(next);
          }}
          settings={settings}
          onBack={() => setScreen('menu')}
          onSettings={goToSettings}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'collection') {
    return (
      <div onClick={handleUnlock}>
        <CollectionVault onBack={() => setScreen('menu')} />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'puzzles') {
    return (
      <div onClick={handleUnlock}>
        <PuzzleScreen onBack={() => setScreen('menu')} />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'botselect') {
    const botSelectSubtitle =
      botSelectMode === 'practice'
        ? 'Pick a bot, then set up any modifiers for both sides'
        : botSelectMode === 'quick'
          ? 'Pick a bot - standard chess, no modifiers'
          : 'Pick a bot, then draft modifiers';

    return (
      <div onClick={handleUnlock}>
        <BotSelect
          onSelect={handleBotSelect}
          onBack={() => setScreen('menu')}
          subtitle={botSelectSubtitle}
          mode={botSelectMode ?? 'run'}
          onModeChange={mode => {
            setBotSelectMode(mode);
            setCurrentMatchMode(mode === 'run' ? 'story' : 'quick');
          }}
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
          practice={botSelectMode === 'practice'}
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
        <section className={styles.matchHud} data-mobile-tab={drawer.tab} data-drawer={drawer.open ? 'open' : 'closed'}>
          <div className={styles.bannerRow}>
            <div className={styles.selfSlot}>
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
            <ChatBubble text={drawer.bubble?.side === 'self' ? drawer.bubble.text : null} />
            </div>
            <div className={styles.opponentSlot}>
            <PlayerBanner
              role={vsBot ? 'AI' : 'Opponent'}
              name={opponentName}
              metaLine={`${opponentTitle} - Lv ${opponentLevel} - ELO ${botProfile?.elo ?? 1200}`}
              subtitle={botProfile?.motto || opponentTagline}
              badge={gameState.turn === 'black' ? (vsBot && botThinking ? 'Thinking…' : 'To Move') : 'Standing By'}
              portraitLabel={selectedBotProfile?.icon ?? selectedBotProfile?.name.slice(0, 1).toUpperCase() ?? 'O'}
              portraitSrc={selectedBotProfile?.sprite ?? null}
              portraitPixelArt
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
            <ChatBubble text={drawer.bubble?.side === 'opponent' ? drawer.bubble.text : null} />
            </div>
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
                opponentAvatarIcon={selectedBotProfile?.sprite ? null : selectedBotProfile?.icon ?? null}
                opponentAvatarSrc={selectedBotProfile?.sprite ?? null}
                pendingDialogue={pendingDialogue}
                onDismissDialogue={handleDialogueDismiss}
                viewerColor={vsBot ? 'white' : undefined}
              />
            </div>

            <div className={styles.boardOnly}>
              <div className={styles.boardShell}>
                <Board
                  state={gameState}
                  onStateChange={setGameState}
                  controlColor={vsBot ? 'white' : undefined}
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

          <MatchTicker line={latestFeedLine(gameState, playerName, vsBot ? opponentName : 'Black', vsBot ? 'white' : undefined)} onOpen={() => drawer.setOpen(true)} />
          <MatchDrawerBar drawer={drawer} modifierCount={gameState.activeModifiers.length} />
        </section>
      </main>

      {settingsOverlay}
      {surveyOverlay}
      {viewedProfileOverlay}
    </div>
  );
}
