import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { prngPickIndex } from '../../engine/prng';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';

const ID = 'MOD-A002';
const LAVA_COUNT = 4;
const ROTATION_INTERVAL = 10;

const ALL_SQUARES: Square[] = (() => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const result: Square[] = [];
  for (const f of files) for (const r of ranks) result.push(`${f}${r}` as Square);
  return result;
})();

function placeLava(state: GameState, count: number): GameState {
  const next = cloneState(state);
  const available = ALL_SQUARES.filter(sq => !next.pieces.has(sq));
  let prngState = next.prngState;

  for (let i = 0; i < count && available.length > 0; i++) {
    const [idx, nextPrng] = prngPickIndex(prngState, available.length);
    prngState = nextPrng;
    const sq = available.splice(idx, 1)[0];
    const existing = next.tiles.get(sq);
    if (existing) {
      next.tiles.set(sq, {
        ...existing,
        effects: [...existing.effects, { type: 'lava', turnsRemaining: -1 }],
      });
    } else {
      next.tiles.set(sq, { square: sq, effects: [{ type: 'lava', turnsRemaining: -1 }] });
    }
  }
  next.prngState = prngState;
  return next;
}

function clearAllLava(state: GameState): GameState {
  const next = cloneState(state);
  for (const [sq, tile] of next.tiles) {
    const effects = tile.effects.filter(e => e.type !== 'lava');
    if (effects.length === 0) next.tiles.delete(sq);
    else next.tiles.set(sq, { ...tile, effects });
  }
  return next;
}

export const floorIsLavaDef: ModifierDefinition = {
  id: ID,
  name: 'Floor is Lava',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',

  onActivate(state) {
    return placeLava(state, LAVA_COUNT);
  },

  onTurnStart(state) {
    if (state.turnNumber > 1 && (state.turnNumber - 1) % ROTATION_INTERVAL === 0) {
      return placeLava(clearAllLava(state), LAVA_COUNT);
    }
    return state;
  },

  onPostMove(state, _move) {
    // Capture any non-king piece standing on a lava square after the move
    const next = cloneState(state);
    const lavaVictims: string[] = [];
    for (const [sq, tile] of next.tiles) {
      if (!tile.effects.some(e => e.type === 'lava')) continue;
      const piece = next.pieces.get(sq);
      if (piece && piece.type !== 'king') {
        lavaVictims.push(`${piece.color} ${piece.type} on ${sq}`);
        next.pieces.delete(sq);
      }
    }
    if (lavaVictims.length === 0) return next;

    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Lava',
      message:
        lavaVictims.length === 1
          ? `${lavaVictims[0]} burned up on lava.`
          : `${lavaVictims.join(', ')} burned up on lava.`,
    });
  },
};
