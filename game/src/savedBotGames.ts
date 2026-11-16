import type { GameState, Move, Square } from '@pigeon-chess/game-core';
import { chessEngine, modifierRegistry, touchPiece } from '@pigeon-chess/game-core';
import type { BotId } from './opponents';
import type { MatchMode } from './profile';

/**
 * Bot games in progress, kept in localStorage so a reload or a closed tab
 * does not lose them. We save the seed, the draft and the list of actions,
 * then rebuild the state through game-core. A raw state blob could drift
 * between builds; a replay stays exact.
 */
const SAVED_KEY = 'pigeon-chess-bot-games';
/** Bump when the saved shape or the replay rules change. Older saves are dropped. */
export const SAVE_VERSION = 1;
export const MAX_SAVED_GAMES = 20;

const BOT_IDS: readonly BotId[] = ['chick', 'pigeon', 'magnus'];

export type BotSelectMode = 'run' | 'quick' | 'practice';

/** One thing a player did to the board. Replayed in order to rebuild the game. */
export type SavedAction =
  | { t: 'move'; move: Move }
  | { t: 'shoo' }
  | { t: 'touch'; square: Square };

export type DraftTurn = 'player' | 'opponent' | 'done';

/** The modifier draft so far. The random source is a seed plus how many draws it has made. */
export interface DraftSnapshot {
  playerIds: string[];
  botIds: string[];
  turn: DraftTurn;
  randomLocked: boolean;
  seed: number;
  draws: number;
}

export interface SavedMatch {
  prngSeed: number;
  playerModifierIds: string[];
  botModifierIds: string[];
  actions: SavedAction[];
}

export interface SavedBotGame {
  v: typeof SAVE_VERSION;
  /** Also the game state's id once the match starts. */
  id: string;
  bot: BotId;
  mode: BotSelectMode;
  matchMode: MatchMode;
  startedAt: string;
  updatedAt: string;
  /** Set while the draft runs. */
  draft?: DraftSnapshot;
  /** Set once the match has started. */
  match?: SavedMatch;
  /** For the Ongoing games list only. The replay never reads it. */
  summary?: SavedSummary;
}

export interface SavedSummary {
  turn: 'white' | 'black';
  /** Moves played so far (plies). */
  moves: number;
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): KeyValueStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

function isAction(value: unknown): value is SavedAction {
  const action = value as SavedAction | null;
  if (!action || typeof action !== 'object') return false;
  if (action.t === 'shoo') return true;
  if (action.t === 'touch') return typeof action.square === 'string';
  if (action.t === 'move') {
    const move = action.move as Move | undefined;
    return typeof move?.from === 'string' && typeof move?.to === 'string' && typeof move?.playerColor === 'string';
  }
  return false;
}

function isDraft(value: unknown): value is DraftSnapshot {
  const draft = value as DraftSnapshot | null;
  return (
    !!draft &&
    isStringList(draft.playerIds) &&
    isStringList(draft.botIds) &&
    (draft.turn === 'player' || draft.turn === 'opponent' || draft.turn === 'done') &&
    typeof draft.randomLocked === 'boolean' &&
    Number.isInteger(draft.seed) &&
    Number.isInteger(draft.draws) &&
    draft.draws >= 0
  );
}

function isMatch(value: unknown): value is SavedMatch {
  const match = value as SavedMatch | null;
  return (
    !!match &&
    Number.isInteger(match.prngSeed) &&
    isStringList(match.playerModifierIds) &&
    isStringList(match.botModifierIds) &&
    Array.isArray(match.actions) &&
    match.actions.every(isAction)
  );
}

/** A save from this build, well formed. Anything else (an older version, a hand edit) is dropped. */
function isSavedGame(value: unknown): value is SavedBotGame {
  const game = value as SavedBotGame | null;
  if (!game || typeof game !== 'object') return false;
  if (game.v !== SAVE_VERSION) return false;
  if (typeof game.id !== 'string' || !BOT_IDS.includes(game.bot)) return false;
  if (game.mode !== 'run' && game.mode !== 'quick' && game.mode !== 'practice') return false;
  if (game.matchMode !== 'story' && game.matchMode !== 'quick') return false;
  if (typeof game.startedAt !== 'string' || typeof game.updatedAt !== 'string') return false;
  if (game.match !== undefined) return isMatch(game.match);
  return isDraft(game.draft);
}

/** Saved games, last played first. */
export function readSavedGames(store: KeyValueStore | null = storage()): SavedBotGame[] {
  try {
    const raw = store?.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedGame).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function write(games: SavedBotGame[], store: KeyValueStore | null): void {
  try {
    store?.setItem(SAVED_KEY, JSON.stringify(games));
  } catch {
    // Storage full or blocked: the game still plays, it just can't be resumed.
  }
}

/** Adds or replaces a save. Keeps the newest MAX_SAVED_GAMES. */
export function saveGame(game: SavedBotGame, store: KeyValueStore | null = storage()): SavedBotGame[] {
  const rest = readSavedGames(store).filter(saved => saved.id !== game.id);
  const next = [game, ...rest].slice(0, MAX_SAVED_GAMES);
  write(next, store);
  return next;
}

export function removeSavedGame(id: string, store: KeyValueStore | null = storage()): SavedBotGame[] {
  const next = readSavedGames(store).filter(saved => saved.id !== id);
  write(next, store);
  return next;
}

export function findSavedGame(id: string, store: KeyValueStore | null = storage()): SavedBotGame | null {
  return readSavedGames(store).find(saved => saved.id === id) ?? null;
}

/** The position the match starts from: the drafted modifiers on, first turn begun. */
export function startMatchState(
  id: string,
  prngSeed: number,
  playerModifierIds: string[],
  botModifierIds: string[],
): GameState {
  let state: GameState = { ...chessEngine.getInitialState(), id, prngSeed, prngState: prngSeed };
  if (playerModifierIds.length > 0 || botModifierIds.length > 0) {
    state = chessEngine.activateDraftModifiers(state, [
      ...playerModifierIds.map(modId => ({ id: modId, sourceColor: 'white' as const })),
      ...botModifierIds.map(modId => ({ id: modId, sourceColor: 'black' as const })),
    ]);
  }
  return chessEngine.beginTurn(state);
}

/** Applies one action, or returns null if it is not legal in this position. */
export function applyAction(state: GameState, action: SavedAction): GameState | null {
  if (state.status !== 'active') return null;
  if (action.t === 'move') {
    if (!chessEngine.validateMove(state, action.move).valid) return null;
    return chessEngine.applyMove(state, action.move);
  }
  if (action.t === 'shoo') {
    return chessEngine.canShooGerald(state) ? chessEngine.shooGerald(state) : null;
  }
  const next = touchPiece(state, action.square);
  return next === state ? null : next;
}

/**
 * Rebuilds a saved match by replaying it. Returns null if any action no longer
 * applies, so a save the rules have moved past is dropped rather than played wrong.
 */
export function rebuildMatch(id: string, match: SavedMatch): GameState | null {
  // A card this build no longer has would replay as a different game.
  const ids = [...match.playerModifierIds, ...match.botModifierIds];
  if (ids.some(modId => !modifierRegistry.get(modId))) return null;
  try {
    let state = startMatchState(id, match.prngSeed, match.playerModifierIds, match.botModifierIds);
    for (const action of match.actions) {
      const next = applyAction(state, action);
      if (!next) return null;
      state = next;
    }
    return state;
  } catch {
    return null;
  }
}

/** A short random id that works without crypto.randomUUID (plain http on a phone). */
export function newSaveId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
