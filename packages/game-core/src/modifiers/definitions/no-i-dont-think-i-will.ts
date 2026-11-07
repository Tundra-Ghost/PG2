import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.noIDontThinkIWill;
/** The owner's first 5 moves use flipped controls. */
export const FLIPPED_MOVES = 5;
const FILES = 'abcdefgh';

/** The square across the board's centre: e2 ↔ d7, a1 ↔ h8. */
export function flipSquare(square: Square): Square {
  return `${FILES[7 - FILES.indexOf(square[0])]}${9 - Number(square[1])}` as Square;
}

function movesMade(state: GameState, color: Color): number {
  return state.moveHistory.filter(record => record.move.playerColor === color).length;
}

/** Own moves `color` still makes with flipped controls (0 when not cursed). */
export function flippedMovesLeft(state: GameState, color: Color): number {
  if (!affectsColor(state, ID, color)) return 0;
  return Math.max(0, FLIPPED_MOVES - movesMade(state, color));
}

/**
 * MOD-B003 (curse): for the owner's first 5 moves, every click lands on the
 * square across the board's centre. Forward becomes backward and left
 * becomes right. Picking up a piece is not flipped, and every move is
 * still a normal legal move. Input only: the board does the flipping.
 */
export const noIDontThinkIWillDef: ModifierDefinition = {
  id: ID,
  name: 'No, I Don\'t Think I Will',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onPostMove(state, move) {
    const color = move.playerColor;
    if (!affectsColor(state, ID, color) || movesMade(state, color) + 1 !== FLIPPED_MOVES) return state;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'No, I Don\'t Think I Will',
      message: `The ${color} side's controls are back to normal.`,
    });
  },
};
