import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.imposterSyndrome;
const REASON = 'Imposter Syndrome: your Queen doubts herself. She can only move one square.';

function distance(a: Square, b: Square): number {
  return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
}

/** True when the move is a doubting Queen trying to go further than one square. */
function isBigStep(state: GameState, move: Move): boolean {
  if (move.ability) return false;
  const piece = state.pieces.get(move.from);
  return piece?.isDoubting === true && distance(move.from, move.to) > 1;
}

/** True when the doubt binds `color` this turn (not in check, and another move exists). */
export function isQueenDoubting(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

registerMoveRule(ID, (state, color) => {
  if (!affectsColor(state, ID, color)) return null;
  const doubting = Array.from(state.pieces.values()).some(p => p.color === color && p.isDoubting);
  return doubting ? { allows: (s, move) => !isBigStep(s, move), reason: REASON, demand: false } : null;
});

interface ImposterState {
  /** The Queen that captured on this move; she keeps her doubt through onPostMove. */
  justCaptured?: string;
}

/** MOD-B014: after your Queen captures, her next move can only be one square. */
export const imposterSyndromeDef: ModifierDefinition = {
  id: ID,
  name: 'Imposter Syndrome',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  onCapture(state, move) {
    // A pawn that captures and promotes to a Queen was not a Queen when it captured.
    if (move.ability || move.promotion) return state;
    const queen = state.pieces.get(move.to);
    if (!queen || queen.type !== 'queen' || queen.color !== move.playerColor) return state;
    if (!affectsColor(state, ID, queen.color)) return state;
    const next = cloneState(state);
    next.pieces.set(move.to, { ...queen, isDoubting: true });
    next.modifierState = { ...next.modifierState, [ID]: { justCaptured: queen.id } satisfies ImposterState };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'IMPOSTER SYNDROME',
      message: `The ${queen.color} queen on ${move.to} doubts herself. Her next move is only one square.`,
      squares: [move.to],
    });
  },

  onPostMove(state, move) {
    const just = (state.modifierState[ID] as ImposterState | undefined)?.justCaptured;
    if (move.ability) return just ? { ...state, modifierState: { ...state.modifierState, [ID]: {} } } : state;
    const mover = state.pieces.get(move.to);
    const clear = mover?.isDoubting === true && mover.color === move.playerColor && mover.id !== just;
    if (!clear && !just) return state;
    const next = cloneState(state);
    if (clear) next.pieces.set(move.to, { ...mover!, isDoubting: false });
    next.modifierState = { ...next.modifierState, [ID]: {} };
    return next;
  },
};
