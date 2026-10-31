import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { getLegalMovesForPiece, isInCheck } from '../../engine/moveGenerator';
import { prngPickIndex } from '../../engine/prng';
import { getModifierOwner } from '../owner';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.hatofulGambit;
/** Pigeons hop every 5 rounds. */
export const PIGEON_HOP_PLIES = 10;
/** The hop square is announced this many plies before the hop. */
export const PIGEON_WARNING_PLIES = 2;

interface Flock {
  /** Pigeon id → announced hop square. */
  plans: Record<string, Square>;
}

function plans(state: GameState): Record<string, Square> {
  return (state.modifierState[ID] as Flock | undefined)?.plans ?? {};
}

function withPlans(state: GameState, next: Record<string, Square>): GameState {
  state.modifierState = { ...state.modifierState, [ID]: { plans: next } satisfies Flock };
  return state;
}

/** The announced hop squares, for the board to show. */
export function getPigeonHops(state: GameState): Map<Square, Color> {
  const result = new Map<Square, Color>();
  const planned = plans(state);
  for (const piece of state.pieces.values()) {
    const to = planned[piece.id];
    if (to && piece.type === 'pigeon') result.set(to, piece.color);
  }
  return result;
}

function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

/** Pigeon hops that never take a King or leave either King in check. */
function safeHops(state: GameState, pigeon: Piece, mover: Color): Square[] {
  return getLegalMovesForPiece(state, pigeon).filter(to => {
    if (state.pieces.get(to)?.type === 'king') return false;
    const after = hop(cloneState(state), pigeon, to);
    return !isInCheck(after, pigeon.color) && !isInCheck(after, mover);
  });
}

function hop(state: GameState, pigeon: Piece, to: Square): GameState {
  state.pieces.delete(pigeon.square);
  state.pieces.set(to, { ...pigeon, square: to });
  return state;
}

/**
 * MOD-E001: the owner's knights become Pigeons. Every 5 rounds each Pigeon
 * announces a square, then hops there on its own one move later.
 */
export const hatofulGambitDef: ModifierDefinition = {
  id: ID,
  name: 'Hatoful Gambit',
  category: 'E',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const next = cloneState(state);
    for (const piece of next.pieces.values()) {
      if (piece.type !== 'knight' || (owner && piece.color !== owner)) continue;
      next.pieces.set(piece.square, { ...piece, type: 'pigeon' });
    }
    return next;
  },

  onPostMove(state) {
    const plies = state.moveHistory.length + 1;
    const mover = state.turn;
    const phase = plies % PIGEON_HOP_PLIES;

    if (phase === PIGEON_HOP_PLIES - PIGEON_WARNING_PLIES) {
      const next = cloneState(state);
      const planned: Record<string, Square> = {};
      const squares: Square[] = [];
      for (const piece of next.pieces.values()) {
        if (piece.type !== 'pigeon') continue;
        const options = safeHops(next, piece, mover);
        if (options.length === 0) continue;
        const [idx, prng] = prngPickIndex(next.prngState, options.length);
        next.prngState = prng;
        planned[piece.id] = options[idx];
        squares.push(options[idx]);
      }
      withPlans(next, planned);
      if (squares.length === 0) return next;
      return appendGameEvent(next, {
        ply: plies,
        type: 'modifier',
        modifierId: ID,
        title: 'Hatoful Gambit',
        squares,
        message: `The pigeons eye ${squares.join(', ')}. They hop next move.`,
      });
    }

    if (phase !== 0) return state;
    const planned = plans(state);
    if (Object.keys(planned).length === 0) return state;

    let next = withPlans(cloneState(state), {});
    const landed: Square[] = [];
    const notes: string[] = [];
    for (const piece of [...next.pieces.values()]) {
      const to = planned[piece.id];
      if (!to || piece.type !== 'pigeon') continue;
      if (!safeHops(next, piece, mover).includes(to)) {
        notes.push(`The ${piece.color} pigeon on ${piece.square} stays put.`);
        continue;
      }
      const victim = next.pieces.get(to);
      next = hop(next, piece, to);
      landed.push(to);
      notes.push(victim
        ? `The ${piece.color} pigeon hops ${piece.square}-${to} and takes the ${opponent(piece.color)} ${victim.type.replace('_', ' ')}.`
        : `The ${piece.color} pigeon hops ${piece.square}-${to}.`);
    }
    if (notes.length === 0) return next;
    return appendGameEvent(next, {
      ply: plies,
      type: 'modifier',
      modifierId: ID,
      title: 'Hatoful Gambit',
      squares: landed,
      message: notes.join(' '),
    });
  },
};
