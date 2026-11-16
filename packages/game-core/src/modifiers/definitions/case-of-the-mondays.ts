import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.caseOfTheMondays;
/** The curse lasts for this many of your moves. */
export const MONDAY_MOVES = 6;
/** Longest move allowed, in squares (a knight jump counts as 2). */
export const MONDAY_REACH = 2;
const REASON = `Case Of The Mondays: for your first ${MONDAY_MOVES} moves, no piece moves more than ${MONDAY_REACH} squares.`;

/** Squares moved, counted like a King walks: a knight jump is 2, castling moves the King 2. */
function distance(move: Move): number {
  const files = Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0));
  const ranks = Math.abs(Number(move.from[1]) - Number(move.to[1]));
  return Math.max(files, ranks);
}

/** True while `color` is still on its Monday moves. */
export function isMonday(state: GameState, color: Color): boolean {
  return affectsColor(state, ID, color) && ownMoveNumber(state, color) <= MONDAY_MOVES;
}

/** True when the limit binds `color` this turn (not in check, and some short move exists). */
export function isMondayLimited(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

registerMoveRule(ID, (state, color) => {
  if (!isMonday(state, color)) return null;
  return {
    // Abilities are not limited: they are not ordinary moves.
    allows: (_s, move) => !!move.ability || distance(move) <= MONDAY_REACH,
    reason: REASON,
    demand: false,
  };
});

/** MOD-B011 Case Of The Mondays: for your first 6 moves, no piece moves more than 2 squares. */
export const caseOfTheMondaysDef: ModifierDefinition = {
  id: ID,
  name: 'Case Of The Mondays',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  onPostMove(state, move) {
    const color = move.playerColor;
    if (!affectsColor(state, ID, color) || ownMoveNumber(state, color) !== MONDAY_MOVES) return state;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'CASE OF THE MONDAYS',
      message: `${color === 'white' ? 'White' : 'Black'} has had coffee. Pieces move full distance again.`,
    });
  },
};
