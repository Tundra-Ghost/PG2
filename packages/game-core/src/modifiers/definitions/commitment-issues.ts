import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { buildMove, cloneState, getValidPromotionTypes, isPromotionMove } from '../../engine/gameLoop';
import { getLegalMovesForPiece } from '../../engine/moveGenerator';
import { validateMove } from '../../engine/moveValidator';
import { getAbilityOptions } from '../../engine/abilities';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.commitmentIssues;

const NAMES: Partial<Record<Piece['type'], string>> = { royal_guard: 'Royal Guard' };

function pieceName(piece: Piece): string {
  return NAMES[piece.type] ?? piece.type;
}

/** The piece `color` touched this turn, if any. */
export function getTouchedPiece(state: GameState, color: Color): Piece | null {
  for (const piece of state.pieces.values()) {
    if (piece.color === color && piece.isTouched) return piece;
  }
  return null;
}

/** True if the piece on `square` has any move or ability that passes full validation. */
function hasValidAction(state: GameState, square: Square): boolean {
  const piece = state.pieces.get(square);
  if (!piece) return false;
  for (const to of getLegalMovesForPiece(state, piece)) {
    const ok = isPromotionMove(state, square, to)
      ? getValidPromotionTypes(state, square, to).length > 0
      : validateMove(state, { ...buildMove(state, square, to), playerColor: piece.color }).valid;
    if (ok) return true;
  }
  return getAbilityOptions(state, square).some(option => option.targets.length > 0);
}

/** True when the side to move is bound by touch-move. */
export function hasTouchMove(state: GameState, color: Color): boolean {
  return state.status === 'active' && affectsColor(state, ID, color);
}

/**
 * MOD-B015: the owner selects (touches) a piece. A piece with no legal move
 * does not count, and a second touch in the same turn changes nothing.
 * Returns the state unchanged when the touch does not count.
 */
export function touchPiece(state: GameState, square: Square): GameState {
  const piece = state.pieces.get(square);
  if (!piece || piece.color !== state.turn || !hasTouchMove(state, piece.color)) return state;
  if (getTouchedPiece(state, piece.color)) return state;
  if (!hasValidAction(state, square)) return state;
  const next = cloneState(state);
  next.pieces.set(square, { ...piece, isTouched: true });
  return next;
}

export function touchedReason(piece: Piece): string {
  return `Commitment Issues: you touched the ${pieceName(piece)} on ${piece.square}. You must move it.`;
}

/** MOD-B015 Commitment Issues: once you select a piece that can move, you must move that piece. */
export const commitmentIssuesDef: ModifierDefinition = {
  id: ID,
  name: 'Commitment Issues',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onPreMoveValidate(state, move) {
    const touched = getTouchedPiece(state, move.playerColor);
    if (!touched || touched.square === move.from) return { blocked: false };
    return { blocked: true, reason: touchedReason(touched) };
  },

  blocksPass(state) {
    const touched = getTouchedPiece(state, state.turn);
    return touched ? touchedReason(touched) : null;
  },

  onPostMove(state) {
    if (!Array.from(state.pieces.values()).some(p => p.isTouched)) return state;
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      if (piece.isTouched) {
        const { isTouched: _done, ...rest } = piece;
        next.pieces.set(sq, rest);
      }
    }
    return next;
  },
};
