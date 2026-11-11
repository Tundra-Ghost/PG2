import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { prngPickIndex } from '../../engine/prng';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.floorIsLava;
const LAVA_COUNT = 4;
const ROTATION_INTERVAL = 3;

const ALL_SQUARES: Square[] = (() => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const result: Square[] = [];
  for (const f of files) for (const r of ranks) result.push(`${f}${r}` as Square);
  return result;
})();

interface LavaState {
  /** Where lava goes at the next rotation, shown to both players. */
  next: Square[];
}

/** The squares lava moves to at the next rotation. Empty without the card. */
export function getLavaPreview(state: GameState): Square[] {
  return (state.modifierState[ID] as LavaState | undefined)?.next ?? [];
}

function isLava(state: GameState, sq: Square): boolean {
  return state.tiles.get(sq)?.effects.some(e => e.type === 'lava') ?? false;
}

function isOpen(state: GameState, sq: Square): boolean {
  return !state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid;
}

/**
 * Picks `count` open squares. `wanted` squares come first while they are
 * still open, then random squares, avoiding `avoid` when it can.
 */
function pickSquares(state: GameState, count: number, wanted: Square[], avoid: Square[]): [Square[], number] {
  const picked = wanted.filter(sq => isOpen(state, sq)).slice(0, count);
  const blocked = new Set(avoid);
  const open = ALL_SQUARES.filter(sq => isOpen(state, sq) && !picked.includes(sq));
  let prngState = state.prngState;
  // Draw from the unblocked squares first; blocked ones only fill a gap.
  for (const pool of [open.filter(sq => !blocked.has(sq)), open.filter(sq => blocked.has(sq))]) {
    while (picked.length < count && pool.length > 0) {
      const [idx, nextPrng] = prngPickIndex(prngState, pool.length);
      prngState = nextPrng;
      picked.push(pool.splice(idx, 1)[0]);
    }
  }
  return [picked, prngState];
}

function placeLava(state: GameState, squares: Square[]): GameState {
  const next = cloneState(state);
  for (const sq of squares) {
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
  return next;
}

/** Chooses and stores the next lava squares, away from the current lava. */
function choosePreview(state: GameState): GameState {
  const current = ALL_SQUARES.filter(sq => isLava(state, sq));
  const next = cloneState(state);
  const [squares, prngState] = pickSquares(state, LAVA_COUNT, [], current);
  next.prngState = prngState;
  next.modifierState = { ...next.modifierState, [ID]: { next: squares } satisfies LavaState };
  return next;
}

function clearAllLava(state: GameState): GameState {
  const next = cloneState(state);
  for (const [sq, tile] of next.tiles) {
    const effects = tile.effects.filter(e => e.type !== 'lava');
    // Keep tiles that carry other modifier flags (Swamp, vents, ...).
    const { square: _square, effects: _effects, ...flags } = tile;
    const hasFlags = Object.values(flags).some(Boolean);
    if (effects.length === 0 && !hasFlags) next.tiles.delete(sq);
    else next.tiles.set(sq, { ...tile, effects });
  }
  return next;
}

export const floorIsLavaDef: ModifierDefinition = {
  id: ID,
  name: 'The Floor Is Lava',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const [squares, prngState] = pickSquares(state, LAVA_COUNT, [], []);
    return choosePreview(placeLava({ ...state, prngState }, squares));
  },

  onTurnStart(state) {
    if (state.turnNumber > 1 && state.turnNumber % ROTATION_INTERVAL === 0) {
      const previousLavaSquares = Array.from(state.tiles.entries())
        .filter(([, tile]) => tile.effects.some(effect => effect.type === 'lava'))
        .map(([square]) => square);
      // Lava moves to the previewed squares. One that a piece now stands on
      // is swapped for a random open square.
      const cleared = clearAllLava(state);
      const [squares, prngState] = pickSquares(cleared, LAVA_COUNT, getLavaPreview(state), previousLavaSquares);
      return choosePreview(placeLava({ ...cleared, prngState }, squares));
    }
    return state;
  },

  onPostMove(state, _move) {
    // Capture any non-king piece standing on a lava square after the move
    const next = cloneState(state);
    const lavaVictims: string[] = [];
    const burned: Square[] = [];
    for (const [sq, tile] of next.tiles) {
      if (!tile.effects.some(e => e.type === 'lava')) continue;
      const piece = next.pieces.get(sq);
      if (piece && piece.type !== 'king') {
        lavaVictims.push(`${piece.color} ${piece.type} on ${sq}`);
        burned.push(sq);
        next.pieces.delete(sq);
      }
    }
    if (lavaVictims.length === 0) return next;

    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Lava',
      squares: burned,
      message:
        lavaVictims.length === 1
          ? `${lavaVictims[0]} burns in lava.`
          : `${lavaVictims.join(', ')} burn in lava.`,
    });
  },
};
