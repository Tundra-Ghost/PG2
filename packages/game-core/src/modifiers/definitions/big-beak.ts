import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.bigBeak;
const FILES = 'abcdefgh';
/** A revealed piece stays visible for 3 rounds. */
export const REVEAL_PLIES = 6;
/** The eye sits somewhere in the middle 4×4. */
const EYE_SQUARES: Square[] = [];
for (let f = 2; f <= 5; f++) for (let r = 3; r <= 6; r++) EYE_SQUARES.push(`${FILES[f]}${r}` as Square);
const DEFAULT_EYE: Square = 'd5';

interface Watch {
  eye: Square;
  /** Piece id → last ply it stays revealed. */
  seen: Record<string, number>;
}

function watch(state: GameState): Watch {
  return (state.modifierState[ID] as Watch | undefined) ?? { eye: DEFAULT_EYE, seen: {} };
}

/** The Surveillance Square, or null without the card. */
export function getSurveillanceSquare(state: GameState): Square | null {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return null;
  return watch(state).eye;
}

function nearEye(square: Square, eye: Square): boolean {
  const df = Math.abs(FILES.indexOf(square[0]) - FILES.indexOf(eye[0]));
  const dr = Math.abs(Number(square[1]) - Number(eye[1]));
  return df <= 1 && dr <= 1;
}

/**
 * MOD-D008: one tile is the Surveillance Square, shown to both players as a
 * golden eye. A piece that moves within 1 square of it is shown to both
 * players for 3 rounds, through any fog.
 */
export const bigBeakDef: ModifierDefinition = {
  id: ID,
  name: 'Big Beak Is Watching',
  category: 'D',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const next = cloneState(state);
    const [idx, prng] = prngPickIndex(next.prngState, EYE_SQUARES.length);
    next.prngState = prng;
    next.modifierState = { ...next.modifierState, [ID]: { eye: EYE_SQUARES[idx], seen: {} } satisfies Watch };
    return next;
  },

  onPostMove(state, move) {
    if (move.ability) return state;
    const piece = state.pieces.get(move.to);
    const current = watch(state);
    if (!piece || !nearEye(move.to, current.eye)) return state;
    const plies = state.moveHistory.length + 1;
    const next = cloneState(state);
    next.modifierState = {
      ...next.modifierState,
      [ID]: { ...current, seen: { ...current.seen, [piece.id]: plies + REVEAL_PLIES } } satisfies Watch,
    };
    if (current.seen[piece.id] !== undefined && current.seen[piece.id] >= plies) return next;
    return appendGameEvent(next, {
      ply: plies,
      type: 'modifier',
      modifierId: ID,
      title: 'Big Beak Is Watching',
      squares: [move.to],
      message: `Big Beak spots the ${piece.color} ${piece.type.replace('_', ' ')} on ${move.to}.`,
    });
  },

  getRevealedSquares(state) {
    const plies = state.moveHistory.length;
    const { seen } = watch(state);
    const squares: Square[] = [];
    for (const piece of state.pieces.values()) {
      const until = seen[piece.id];
      if (until !== undefined && until > plies) squares.push(piece.square);
    }
    return squares;
  },
};
