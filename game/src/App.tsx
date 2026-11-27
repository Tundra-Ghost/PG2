import AdminScreen from './components/Admin/AdminScreen';
import { reportUsage } from './online/usage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@pigeon-chess/game-core';
import { MODIFIER_IDS, chessEngine, isOnSpeedrunClock } from '@pigeon-chess/game-core';
import { getBotReaction, getBotSpeaker } from './botChat';
import type { BotId } from './opponents';
import { unlockBgm, playClick, playGameBgm, playMenuBgm } from './sound';
import type { AppSettings } from './settings';
import { applySettings, loadSettings, saveSettings } from './settings';
import LeaveMatchDialog from './components/LeaveMatchDialog/LeaveMatchDialog';
import { shouldAskBeforeLeaving } from './leaveMatch';
import { useAccount } from './online/useAccount';
import { useSocial } from './online/useSocial';
import { MatchDrawerBar, MatchTicker, useMatchDrawer } from './components/MatchDrawer/MatchDrawer';
import { DialogueStage } from './components/DialogueBox/DialogueBox';
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
import LinkAccountGate from './components/LinkAccountGate/LinkAccountGate';
import PuzzleScreen from './components/PuzzleScreen/PuzzleScreen';
import {
  getProfileLevel,
  getSelectedTitle,
  ensureProfile,
  recordProfileMatchCompletion,
  recordProfileMatchStart,
  type LocalProfile,
  type MatchMode,
} from './profile';
import styles from './App.module.css';
import { appBase, historySaveId, pathFor, popTarget, screenFromPath, type Screen } from './routes';
import { markTutorialSeen, stepForScreen, tutorialSeen, type TutorialStep } from './tutorial';
import TutorialCoach from './components/TutorialCoach/TutorialCoach';
import SpeedrunTimer from './components/SpeedrunTimer/SpeedrunTimer';
import OngoingGames from './components/OngoingGames/OngoingGames';
import { abandonCountsAsLoss, describeOnline, describeSeat, movesPlayed } from './ongoingGames';
import { useOnlineGameList } from './online/useOnlineGameList';
import {
  SAVE_VERSION,
  applyAction,
  findSavedDraft,
  newSaveId,
  readSavedGames,
  rebuildMatch,
  removeSavedGame,
  saveGame,
  startMatchState,
  type DraftSnapshot,
  type SavedAction,
  type SavedBotGame,
} from './savedBotGames';


/** Where the game lives, read once: "/play/" on the site. */
const BASE = appBase(window.location.pathname);

/** The address the page opened on. */
const OPENED_ON = screenFromPath(window.location.pathname, BASE);

/** The screen the address opens. A match or draft opens the menu, then the last saved bot game resumes. */
function initialScreen(): Screen {
  return OPENED_ON === 'game' || OPENED_ON === 'draft' ? 'menu' : OPENED_ON;
}

/** Which saved game this tab is showing, so a reload resumes that one and not another tab's. */
const TAB_SAVE_KEY = 'pigeon-chess-tab-save';

function readTabSave(): string | null {
  try {
    return sessionStorage.getItem(TAB_SAVE_KEY);
  } catch {
    return null;
  }
}

function writeTabSave(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(TAB_SAVE_KEY, id);
    else sessionStorage.removeItem(TAB_SAVE_KEY);
  } catch {
    // Storage blocked: a reload opens the menu.
  }
}

/** The match on the board and every action that led to it, which is what gets saved. */
interface MatchLog {
  state: GameState;
  actions: SavedAction[];
}
type BotSelectMode = 'run' | 'quick' | 'practice' | null;

interface ProfileViewerState {
  profile: LocalProfile;
  editable: boolean;
  heading: string;
  subtitle: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  /** The guided first match, as an index into TUTORIAL_STEPS. New players get it on the menu. */
  const [tutorialStep, setTutorialStep] = useState<number | null>(() =>
    screen === 'menu' && !tutorialSeen() ? 0 : null,
  );
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [accountStart, setAccountStart] = useState<'signin' | 'register' | undefined>(undefined);
  const [match, setMatch] = useState<MatchLog>(() => ({ state: chessEngine.getInitialState(), actions: [] }));
  const gameState = match.state;
  /** Puts a new match on the board with an empty action log. */
  const setGameState = (state: GameState) => setMatch({ state, actions: [] });
  /**
   * Plays one action and logs it. With `expected`, does nothing if the board has
   * moved on since (the bot thought about a position that is gone).
   */
  const act = useCallback((action: SavedAction, expected?: GameState) => {
    setMatch(prev => {
      if (expected && prev.state !== expected) return prev;
      const next = applyAction(prev.state, action);
      return next ? { state: next, actions: [...prev.actions, action] } : prev;
    });
  }, []);
  /** The saved game this match or draft is stored under. Also the match's state id. */
  const [saveId, setSaveId] = useState<string | null>(null);
  const saveIdRef = useRef(saveId);
  saveIdRef.current = saveId;
  /** Bot games in progress, for the menu and the Ongoing games list. */
  const [ongoingGames, setOngoingGames] = useState<SavedBotGame[]>(() => readSavedGames());
  /** Why a game just left the Ongoing list, shown there until the next tap. */
  const [ongoingNotice, setOngoingNotice] = useState<string | null>(null);
  /** A saved draft to reopen, read once by the draft screen. */
  const [draftResume, setDraftResume] = useState<DraftSnapshot | null>(null);
  const [vsBot, setVsBot] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotId | null>(null);
  /** The bot is working out its move. */
  const [botThinking, setBotThinking] = useState(false);
  // A link straight to the opponent list starts on the modifier draft tab.
  const [botSelectMode, setBotSelectMode] = useState<BotSelectMode>(() => (screen === 'botselect' ? 'run' : null));
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
  const drawer = useMatchDrawer(chatEntries);
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
  const [profile, setProfile] = useState<LocalProfile>(() => ensureProfile());
  const account = useAccount(profile, setProfile);
  const social = useSocial(account.account?.username ?? null);
  /** Online games for the Ongoing list. Online play needs an account, so guests skip it. */
  const onlineList = useOnlineGameList(screen === 'ongoing' && Boolean(account.account), account.account?.username ?? null);
  /** A room the Online screen should sit down in when it opens. */
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const clearPendingRoom = useCallback(() => setPendingRoomId(null), []);
  /** Where the Online screen's Back goes: the Ongoing list when a game was opened from it. */
  const [onlineBackTo, setOnlineBackTo] = useState<'menu' | 'ongoing'>('menu');
  /** The finished game the debrief is about, while it is open. */
  const [surveyFor, setSurveyFor] = useState<GameSurveyContext | null>(null);
  /** The finished game the result card offers a debrief for, until it is taken. */
  const [debriefReady, setDebriefReady] = useState<GameSurveyContext | null>(null);
  const surveyedIds = useRef(new Set<string>());

  useEffect(() => {
    // A new screen starts at the top. Without this, mobile kept the draft
    // screen's scroll offset and opened the match with the board off-screen.
    window.scrollTo(0, 0);
  }, [screen]);

  // ── Addresses: each screen has its own URL, and Back/Forward move between them ──
  const lastScreen = useRef<Screen | null>(null);
  /** Settings was opened with a history entry, so closing it can step back. */
  const settingsPushed = useRef(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const prevScreenRef = useRef(prevScreen);
  prevScreenRef.current = prevScreen;
  const abandonRef = useRef(commitAbandonmentIfNeeded);
  abandonRef.current = () => {
    if (matchIsSaved()) return;
    commitAbandonmentIfNeeded();
    forgetCurrentSave();
  };
  /** Which way out of a match is waiting on "Leave this match?". */
  const [leaveAsk, setLeaveAsk] = useState<'menu' | 'new' | 'back' | null>(null);
  /** A promotion or drop choice is open on the board (Speedrun pauses). */
  const [boardPopup, setBoardPopup] = useState(false);
  /** Set while a confirmed Back is stepping through history, so it is not asked twice. */
  const leaveConfirmed = useRef(false);
  const closeLeaveAsk = useCallback(() => setLeaveAsk(null), []);
  const askLeaveRef = useRef(askLeave);
  askLeaveRef.current = askLeave;
  const selectedBotRef = useRef(selectedBot);
  selectedBotRef.current = selectedBot;

  useEffect(() => {
    const from = lastScreen.current;
    lastScreen.current = screen;
    const path = pathFor(screen, BASE);
    if (window.location.pathname === path) return;
    // Replace rather than add an entry for: the first load, closing Settings,
    // and the draft turning into the match (Back from a match goes to the opponent list).
    const replace = from === null || from === 'settings' || (from === 'draft' && screen === 'game');
    // A draft or match entry remembers its save, so Back reopens that one.
    const entry = (screen === 'draft' || screen === 'game') && saveId ? { saveId } : null;
    if (replace) window.history.replaceState(entry, '', path);
    else window.history.pushState(entry, '', path);
    settingsPushed.current = screen === 'settings' && !replace;
  }, [screen]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const shown = screenRef.current;
      // Settings is an overlay: what matters is the screen under it.
      const current = shown === 'settings' ? prevScreenRef.current : shown;
      const named = screenFromPath(window.location.pathname, BASE);
      // Back out of a match that would count as a loss asks first. The match
      // address goes back on the stack so the board stays put while it asks.
      if (current === 'game' && named !== 'game' && !leaveConfirmed.current && askLeaveRef.current('back')) {
        window.history.pushState({ saveId: saveIdRef.current }, '', pathFor('game', BASE));
        return;
      }
      leaveConfirmed.current = false;
      // Leaving a match by Back counts the same as the Menu button.
      if (current === 'game' && named !== 'game') abandonRef.current();
      const saved = named === 'draft' && current !== 'draft' ? findSavedDraft(historySaveId(event.state)) : null;
      const { screen: next, reopen } = popTarget(current, named, saved !== null, selectedBotRef.current !== null);
      if (next !== named) window.history.replaceState(null, '', pathFor(next, BASE));
      if (next === 'settings') setPrevScreen(current);
      settingsPushed.current = false;
      lastScreen.current = next;
      if (reopen && saved) resumeRef.current(saved);
      else setScreen(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Closes Settings. Steps back through history when opening it added an entry. */
  function closeSettings() {
    if (settingsPushed.current) {
      settingsPushed.current = false;
      window.history.back();
    } else {
      setScreen(prevScreen);
    }
  }

  // The menu's count follows saves made or removed elsewhere (a finished match, another tab).
  useEffect(() => {
    if (screen === 'menu' || screen === 'ongoing') setOngoingGames(readSavedGames());
  }, [screen]);

  useEffect(() => {
    if (screen === 'game') {
      playGameBgm();
    } else {
      playMenuBgm();
    }
  }, [screen]);

  useEffect(() => {
    // Off the match screen the bot waits: a kept match must not move on unseen and unsaved.
    if (screen !== 'game') return;
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
          act({ t: 'move', move }, gameState);
        } else if (chessEngine.canShooGerald(gameState)) {
          // Gerald pinned the only movable piece. The bot spends its turn shooing him.
          act({ t: 'shoo' }, gameState);
        }
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setBotThinking(false);
    };
  }, [screen, vsBot, selectedBot, gameState, act]);

  // Anonymous usage stats: one page load per visit.
  useEffect(() => reportUsage('visit'), []);

  // Save the bot match after every action, so a reload or a closed tab can pick it up.
  // A finished match is removed from the saves.
  useEffect(() => {
    if (screen !== 'game' || !vsBot || !selectedBot || !saveId) return;
    if (match.state.id !== saveId) return;
    if (match.state.status !== 'active') {
      reportUsage('bot_end', saveId);
      removeSavedGame(saveId);
      return;
    }
    recordEvicted(saveGame({
      v: SAVE_VERSION,
      id: saveId,
      bot: selectedBot,
      mode: botSelectMode ?? 'quick',
      matchMode: currentMatchMode,
      startedAt: currentMatchStartedAt,
      updatedAt: new Date().toISOString(),
      match: {
        prngSeed: match.state.prngSeed,
        playerModifierIds: activePlayerModifierIds,
        botModifierIds: pendingBotModifierIds,
        actions: match.actions,
      },
      summary: { turn: match.state.turn, moves: match.state.moveHistory.length },
    }));
  }, [
    match,
    screen,
    vsBot,
    selectedBot,
    saveId,
    botSelectMode,
    currentMatchMode,
    currentMatchStartedAt,
    activePlayerModifierIds,
    pendingBotModifierIds,
  ]);

  /** Saves the bot draft as it changes. */
  function handleDraftChange(draft: DraftSnapshot) {
    if (!saveId || !selectedBot) return;
    recordEvicted(saveGame({
      v: SAVE_VERSION,
      id: saveId,
      bot: selectedBot,
      mode: botSelectMode ?? 'run',
      matchMode: currentMatchMode,
      startedAt: currentMatchStartedAt,
      updatedAt: new Date().toISOString(),
      draft,
    }));
  }

  /** Opens a saved bot game where it was left. Returns false if it could not be rebuilt. */
  function resumeSavedGame(save: SavedBotGame): boolean {
    let state: GameState | null = null;
    if (save.match) {
      state = rebuildMatch(save.id, save.match);
      if (!state || state.status !== 'active') {
        removeSavedGame(save.id);
        return false;
      }
    }
    setSaveId(save.id);
    setSelectedBot(save.bot);
    setVsBot(true);
    setBotSelectMode(save.mode);
    setCurrentMatchMode(save.matchMode);
    setCurrentMatchStartedAt(save.startedAt);
    setChatEntries([]);
    setDialogueQueue([]);
    setPendingDialogue(null);
    if (save.match && state) {
      setActivePlayerModifierIds(save.match.playerModifierIds);
      setPendingBotModifierIds(save.match.botModifierIds);
      setDraftResume(null);
      // The match already started and its moves were already announced.
      recordedStartIds.current.add(state.id);
      lastReactedMoveId.current = `${state.id}:${state.moveHistory.length}`;
      lastAnnouncedEventId.current = state.eventHistory[state.eventHistory.length - 1]?.id ?? null;
      setMatch({ state, actions: save.match.actions });
      setScreen('game');
    } else {
      setActivePlayerModifierIds([]);
      setPendingBotModifierIds([]);
      setDraftResume(save.draft ?? null);
      setScreen('draft');
    }
    return true;
  }
  const resumeRef = useRef(resumeSavedGame);
  resumeRef.current = resumeSavedGame;

  // A reload on a match or draft address picks up the game this tab was showing.
  useEffect(() => {
    if (OPENED_ON !== 'game' && OPENED_ON !== 'draft') return;
    const id = readTabSave();
    const save = id ? readSavedGames().find(saved => saved.id === id) : undefined;
    if (save) resumeRef.current(save);
  }, []);
  // Declared after the resume, so the resume reads the old value first.
  useEffect(() => writeTabSave(saveId), [saveId]);

  /** Opens a fresh draft against the selected bot, saved under a new id. */
  function openDraft() {
    setSaveId(newSaveId());
    setDraftResume(null);
    setPendingBotModifierIds([]);
    setActivePlayerModifierIds([]);
    setCurrentMatchStartedAt(new Date().toISOString());
    setScreen('draft');
  }

  /** Drops the save of the match or draft being left. */
  function forgetCurrentSave() {
    if (saveId) removeSavedGame(saveId);
    setSaveId(null);
  }

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
    if (bannerEvent) setInfoMessage(getModifierEventBannerMessage(bannerEvent, playerName, vsBot ? opponentName : 'Black'));
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

  // Offer the optional debrief on the result card once a local game ends, once
  // per game. It never opens by itself, so the player sees the final board first.
  useEffect(() => {
    if (!isFinished(gameState)) {
      setDebriefReady(null);
      return;
    }
    if (screen !== 'game' || !settings.postGameSurveys) return;
    if (surveyedIds.current.has(gameState.id)) return;
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
    setDebriefReady(context);
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

  /**
   * Shows "Leave this match?" when leaving now would record a loss and the
   * player wants a confirm step. Returns true when it is asking.
   */
  function askLeave(way: 'menu' | 'new' | 'back'): boolean {
    // A saved bot match is kept, not lost, when you leave it. Only New Game gives it up.
    if (way !== 'new' && matchIsSaved()) return false;
    const ask = shouldAskBeforeLeaving({
      confirmResign: settings.confirmResign,
      hasProfile: Boolean(profile),
      state: gameState,
      recordedIds: recordedCompletionIds.current,
    });
    if (!ask) return false;
    setLeaveAsk(way);
    return true;
  }

  function confirmLeave() {
    const way = leaveAsk;
    setLeaveAsk(null);
    if (way === 'menu') leaveToMenu();
    else if (way === 'new') startNewGame();
    else if (way === 'back') {
      leaveConfirmed.current = true;
      window.history.back();
    }
  }

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
    setAccountStart(undefined);
    setPrevScreen(screen);
    setScreen('settings');
  }

  /** Opens Settings on the account form, ready to turn the guest profile into an account. */
  function goToLinkAccount() {
    playClick();
    setAccountStart('register');
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

  // Keep the tour in step with the screen: a new screen opens its first step,
  // and leaving the tour's path (Menu, Back, another mode) ends it.
  useEffect(() => {
    if (tutorialStep === null) return;
    const next = stepForScreen(tutorialStep, screen);
    if (next === null) {
      markTutorialSeen('skipped');
      setTutorialStep(null);
    } else if (next !== tutorialStep) {
      setTutorialStep(next);
    }
  }, [screen, tutorialStep]);

  function handleTutorialAction(step: TutorialStep) {
    if (step.action === 'start-match') {
      // The tour always plays Chick with a modifier draft.
      handleMenuPlay('run');
      setSelectedBot('chick');
      setVsBot(true);
      openDraft();
    } else if (step.action === 'finish') {
      markTutorialSeen('done');
      setTutorialStep(null);
    } else {
      setTutorialStep(current => (current === null ? null : current + 1));
    }
  }

  function skipTutorial() {
    markTutorialSeen('skipped');
    setTutorialStep(null);
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
      // Picking the bot of a draft you just left reopens it, never a second one.
      const left = findSavedDraft(saveId);
      if (left && left.bot === botId && left.mode === botSelectMode && resumeSavedGame(left)) return;
      openDraft();
      return;
    }

    const id = newSaveId();
    const state = startMatchState(id, Date.now() | 0, [], []);
    reportUsage('bot_start', id);
    setSaveId(id);
    setActivePlayerModifierIds([]);
    setPendingBotModifierIds([]);
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
    const id = saveId ?? newSaveId();
    const state = startMatchState(id, Date.now() | 0, playerModifierIds, opponentModifierIds);
    reportUsage('bot_start', id);
    setSaveId(id);
    setDraftResume(null);
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
    if (askLeave('new')) return;
    startNewGame();
  }

  function startNewGame() {
    commitAbandonmentIfNeeded();
    forgetCurrentSave();
    // A modifier match starts over at the draft against the same bot, so the
    // next game has modifiers too. Standard chess just resets the board.
    if (vsBot && selectedBot && (botSelectMode === 'run' || botSelectMode === 'practice')) {
      openDraft();
      return;
    }
    const id = newSaveId();
    const state = startMatchState(id, Date.now() | 0, [], []);
    if (vsBot) reportUsage('bot_start', id);
    setSaveId(id);
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
    if (screen === 'game' && askLeave('menu')) return;
    leaveToMenu();
  }

  function leaveToMenu() {
    if (screen === 'game' && !matchIsSaved()) {
      commitAbandonmentIfNeeded();
      forgetCurrentSave();
    }
    setScreen('menu');
  }

  /** The bot match on the board is saved, so leaving it keeps it in Ongoing games. */
  function matchIsSaved(): boolean {
    if (!vsBot || !saveId || gameState.id !== saveId || gameState.status !== 'active') return false;
    return readSavedGames().some(saved => saved.id === saveId);
  }

  /** Gives up a saved game from the Ongoing list. A started match counts as a loss, as leaving one always has. */
  function abandonSavedGame(save: SavedBotGame) {
    recordAbandonLoss(save);
    if (saveId === save.id) setSaveId(null);
    setOngoingGames(removeSavedGame(save.id));
  }

  /** Started matches pushed out by the save limit count as abandoned, as leaving one used to. */
  function recordEvicted(evicted: SavedBotGame[]) {
    evicted.forEach(recordAbandonLoss);
  }

  function recordAbandonLoss(save: SavedBotGame) {
    if (save.match && abandonCountsAsLoss(save, Boolean(profile), recordedCompletionIds.current)) {
      const nextProfile = recordProfileMatchCompletion(profile, {
        matchId: save.id,
        playedAt: save.startedAt,
        mode: save.matchMode,
        opponentName: getBotSpeaker(save.bot)?.name ?? 'Opponent',
        opponentType: 'bot',
        result: 'loss',
        outcome: 'abandoned',
        moveCount: movesPlayed(save),
        draftedModifierIds: save.match.playerModifierIds,
      });
      recordedCompletionIds.current.add(save.id);
      setProfile(nextProfile);
    }
  }

  function openOngoing() {
    playClick();
    setOngoingNotice(null);
    setOngoingGames(readSavedGames());
    setScreen('ongoing');
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

  /** MOD-B009: the timer bar shows all match when a side this screen plays has Speedrun. */
  const speedrunShown = gameState.activeModifiers.some(mod => mod.id === MODIFIER_IDS.speedrun && (!vsBot || mod.sourceColor !== 'black'));

  const settingsOverlay =
    screen === 'settings' ? (
      <SettingsScreen
        settings={settings}
        onSave={handleSettingsSave}
        onBack={closeSettings}
        account={account}
        feedbackContext={feedbackContext}
        accountStart={accountStart}
      />
    ) : tutorialStep !== null ? (
      <TutorialCoach step={tutorialStep} onAction={handleTutorialAction} onSkip={skipTutorial} />
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
            setOnlineBackTo('menu');
            setScreen('online');
          }}
          onFriends={() => setScreen('friends')}
          onAdmin={account.isAdmin ? () => setScreen('admin') : undefined}
          onLinkAccount={goToLinkAccount}
          onTutorial={() => setTutorialStep(0)}
          onOngoing={openOngoing}
          ongoingCount={ongoingGames.length}
          friendsBadge={social.unread + social.list.incoming.length}
          profile={profile}
          linked={Boolean(account.account) || !account.ready}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'ongoing') {
    return (
      <div onClick={handleUnlock}>
        <OngoingGames
          games={ongoingGames}
          notice={ongoingNotice}
          online={
            !account.account
              ? []
              : onlineList.status === 'ready'
                ? onlineList.games.map(game => describeOnline(game))
                : onlineList.status === 'offline'
                  ? onlineList.seats.map(describeSeat)
                  : []
          }
          onlineNote={
            !account.account
              ? null
              : onlineList.status === 'offline' && onlineList.seats.length > 0
                ? "Can't reach the server right now, so online games show without details."
                : onlineList.status === 'loading'
                  ? 'Checking your online games…'
                  : null
          }
          onResumeOnline={roomId => {
            setPendingRoomId(roomId);
            setOnlineBackTo('ongoing');
            setScreen('online');
          }}
          onResume={save => {
            setOngoingNotice(null);
            if (!resumeSavedGame(save)) {
              setOngoingGames(readSavedGames());
              setOngoingNotice(`The game against ${getBotSpeaker(save.bot)?.name ?? 'the bot'} was saved by an older version and could not be loaded, so it was removed.`);
            }
          }}
          onAbandon={abandonSavedGame}
          onBack={() => setScreen('menu')}
          onPlay={() => handleMenuPlay('run')}
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
          guest={account.ready && !account.account}
          onLinkAccount={goToLinkAccount}
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
          profile={profile}
          editable={false}
          heading="The Roost"
          subtitle="Your records, titles, achievements and match history on this device. Online games are not recorded here yet."
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
            setOnlineBackTo('menu');
            setScreen('online');
          }}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'online' && !account.account) {
    return (
      <div onClick={handleUnlock}>
        <LinkAccountGate
          checking={!account.ready}
          playerName={playerName}
          onLink={goToLinkAccount}
          onSignIn={goToSettings}
          onBack={() => setScreen('menu')}
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
          onBack={() => {
            setScreen(onlineBackTo);
            setOnlineBackTo('menu');
          }}
          onSettings={goToSettings}
        />
        {settingsOverlay}
      </div>
    );
  }

  if (baseScreen === 'admin') {
    return (
      <div onClick={handleUnlock}>
        <AdminScreen onBack={() => setScreen('menu')} />
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
        <PuzzleScreen settings={settings} onBack={() => setScreen('menu')} />
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
          key={saveId ?? 'draft'}
          onStartMatch={handleStartMatch}
          onBack={() => setScreen('botselect')}
          saved={draftResume ?? undefined}
          onDraftChange={handleDraftChange}
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
                  subtitle: `${opponentName}'s record, titles and style of play.`,
                });
              }}
            />
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
                viewerColor={vsBot ? 'white' : undefined}
              />
            </div>

            <div className={`${styles.boardOnly} ${speedrunShown ? styles.boardOnlyTimed : ''}`}>
              {speedrunShown && (
                <SpeedrunTimer
                  state={gameState}
                  active={isOnSpeedrunClock(gameState) && (!vsBot || gameState.turn === 'white')}
                  paused={
                    boardPopup || leaveAsk !== null || profileViewer !== null || surveyFor !== null
                    || pendingDialogue !== null || tutorialStep !== null || screen !== 'game'
                  }
                  onTimeout={(move, from) => act({ t: 'move', move }, from)}
                />
              )}
              <div className={styles.boardShell}>
                <Board
                  state={gameState}
                  onPopupChange={setBoardPopup}
                  onMove={move => act({ t: 'move', move })}
                  onShooGerald={() => act({ t: 'shoo' })}
                  onTouchPiece={square => act({ t: 'touch', square })}
                  controlColor={vsBot ? 'white' : undefined}
                  onInfo={setInfoMessage}
                  notice={infoMessage}
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
              sides={vsBot ? { you: 'white', names: { white: playerName, black: opponentName } } : undefined}
              onDebrief={
                debriefReady
                  ? () => {
                      setSurveyFor(debriefReady);
                      setDebriefReady(null);
                    }
                  : undefined
              }
            />
          </div>

          <MatchTicker line={latestFeedLine(gameState, playerName, vsBot ? opponentName : 'Black', vsBot ? 'white' : undefined)} onOpen={() => drawer.setOpen(true)} />
          <MatchDrawerBar drawer={drawer} modifierCount={gameState.activeModifiers.length} />
          <DialogueStage entry={pendingDialogue} onDismiss={handleDialogueDismiss} raised={drawer.open} />
        </section>
      </main>
      {leaveAsk && <LeaveMatchDialog onLeave={() => { playClick(); confirmLeave(); }} onStay={closeLeaveAsk} />}

      {settingsOverlay}
      {surveyOverlay}
      {viewedProfileOverlay}
    </div>
  );
}
