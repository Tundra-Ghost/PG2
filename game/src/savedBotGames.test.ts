import { describe, expect, it } from 'vitest';
import { chessEngine, getChickBotMove, MODIFIER_IDS, type GameState } from '@pigeon-chess/game-core';
import {
  MAX_SAVED_GAMES,
  SAVE_VERSION,
  applyAction,
  findSavedGame,
  readSavedGames,
  rebuildMatch,
  removeSavedGame,
  saveGame,
  startMatchState,
  type SavedAction,
  type SavedBotGame,
} from './savedBotGames';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

function draftSave(id: string, updatedAt: string): SavedBotGame {
  return {
    v: SAVE_VERSION,
    id,
    bot: 'chick',
    mode: 'run',
    matchMode: 'story',
    startedAt: updatedAt,
    updatedAt,
    draft: { playerIds: ['MOD-B002'], botIds: [], turn: 'opponent', randomLocked: false, seed: 42, draws: 1 },
  };
}

/** Plays a bot-vs-bot game, logging each action the way the app does. */
function playLogged(start: GameState, plies: number): { state: GameState; actions: SavedAction[] } {
  let state = start;
  const actions: SavedAction[] = [];
  for (let i = 0; i < plies && state.status === 'active'; i++) {
    const move = getChickBotMove(state, state.turn);
    const action: SavedAction = move ? { t: 'move', move } : { t: 'shoo' };
    const next = applyAction(state, action);
    if (!next) break;
    actions.push(action);
    state = next;
  }
  return { state, actions };
}

function snapshot(state: GameState) {
  return {
    id: state.id,
    turn: state.turn,
    status: state.status,
    prngState: state.prngState,
    pieces: [...state.pieces.values()].map(p => `${p.color}-${p.type}@${p.square}`).sort(),
    moves: state.moveHistory.map(record => `${record.move.from}${record.move.to}`),
    modifiers: state.activeModifiers.map(mod => `${mod.id}:${mod.sourceColor}`),
    tiles: [...state.tiles.entries()].map(([sq, tile]) => `${sq}:${JSON.stringify(tile)}`).sort(),
  };
}

describe('saved bot games', () => {
  it('rebuilds a modifier match exactly from its seed and actions', () => {
    const playerMods = [MODIFIER_IDS.gerald, MODIFIER_IDS.ventTiles];
    const botMods = [MODIFIER_IDS.berserker, MODIFIER_IDS.cordycepticSpread];
    const start = startMatchState('game-1', 12345, playerMods, botMods);
    const { state, actions } = playLogged(start, 40);
    expect(actions.length).toBeGreaterThan(10);

    const rebuilt = rebuildMatch('game-1', {
      prngSeed: 12345,
      playerModifierIds: playerMods,
      botModifierIds: botMods,
      actions,
    });
    expect(rebuilt).not.toBeNull();
    expect(snapshot(rebuilt!)).toEqual(snapshot(state));
  });

  it('survives a trip through JSON', () => {
    const start = startMatchState('game-2', 7, [], []);
    const { state, actions } = playLogged(start, 12);
    const match = JSON.parse(JSON.stringify({ prngSeed: 7, playerModifierIds: [], botModifierIds: [], actions }));
    expect(snapshot(rebuildMatch('game-2', match)!)).toEqual(snapshot(state));
  });

  it('drops a save whose actions no longer apply', () => {
    const bad: SavedAction[] = [{ t: 'move', move: { from: 'e2', to: 'e5', playerColor: 'white' } }];
    expect(rebuildMatch('x', { prngSeed: 1, playerModifierIds: [], botModifierIds: [], actions: bad })).toBeNull();
  });

  it('drops a save that drafted a card this build does not have', () => {
    expect(rebuildMatch('x', { prngSeed: 1, playerModifierIds: ['MOD-Z999'], botModifierIds: [], actions: [] })).toBeNull();
  });

  it('starts from the plain opening when nothing was drafted', () => {
    const state = startMatchState('plain', 99, [], []);
    expect(state.id).toBe('plain');
    expect(state.prngSeed).toBe(99);
    expect(state.pieces.size).toBe(chessEngine.getInitialState().pieces.size);
  });

  it('keeps the newest saves first and at most twenty', () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_SAVED_GAMES + 5; i++) {
      saveGame(draftSave(`g${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()), store);
    }
    const games = readSavedGames(store);
    expect(games).toHaveLength(MAX_SAVED_GAMES);
    expect(games[0].id).toBe(`g${MAX_SAVED_GAMES + 4}`);
    expect(games.some(game => game.id === 'g0')).toBe(false);
  });

  it('replaces a save with the same id and removes one', () => {
    const store = memoryStore();
    saveGame(draftSave('a', '2026-01-01T00:00:00.000Z'), store);
    saveGame(draftSave('b', '2026-01-02T00:00:00.000Z'), store);
    saveGame({ ...draftSave('a', '2026-01-03T00:00:00.000Z'), bot: 'magnus' }, store);
    expect(readSavedGames(store).map(game => game.id)).toEqual(['a', 'b']);
    expect(findSavedGame('a', store)?.bot).toBe('magnus');
    removeSavedGame('a', store);
    expect(readSavedGames(store).map(game => game.id)).toEqual(['b']);
  });

  it('drops saves from an older version and junk without crashing', () => {
    const store = memoryStore();
    const old = { ...draftSave('old', '2026-01-01T00:00:00.000Z'), v: 0 };
    const good = draftSave('good', '2026-01-01T00:00:00.000Z');
    store.setItem('pigeon-chess-bot-games', JSON.stringify([old, good, null, 'x', { v: SAVE_VERSION }]));
    expect(readSavedGames(store).map(game => game.id)).toEqual(['good']);
    store.setItem('pigeon-chess-bot-games', '{not json');
    expect(readSavedGames(store)).toEqual([]);
  });
});
