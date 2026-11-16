import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Square } from '../../engine/types';
import { getLegalMovesForPiece } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';
import { buildMove, getValidPromotionTypes, isPromotionMove } from '../../engine/gameLoop';
import { validateMove } from '../../engine/moveValidator';
import { getVisibleSquares } from '../../engine/visibility';

const ID = MODIFIER_IDS.peerPressure;
const REASON = 'Peer Pressure: a pawn can capture, so you must capture with a pawn.';

/**
 * True when a pawn on `from` moving to `to` takes something: an enemy piece
 * stands on `to`, or it is en passant. A sideways step (MOD-E014 Crab Rave)
 * changes file onto an empty square and is not a capture.
 */
function isPawnCaptureTarget(state: GameState, from: Square, to: Square): boolean {
  const piece = state.pieces.get(from);
  if (piece?.type !== 'pawn' || from[0] === to[0]) return false;
  const target = state.pieces.get(to);
  if (target) return target.color !== piece.color;
  return to === state.flags.enPassantSquare && from[1] !== to[1];
}

/** A normal (not ability) pawn capture, en passant included. */
function isPawnCapture(state: GameState, move: Move): boolean {
  return !move.ability && isPawnCaptureTarget(state, move.from, move.to);
}

registerMoveRule(ID, (state, color) =>
  affectsColor(state, ID, color) ? { allows: isPawnCapture, reason: REASON, demand: true } : null,
);

/**
 * Every pawn capture `color` may play now, after every other card and the
 * self-check rule have had their say. Under fog, only captures onto squares
 * `color` can see count, so the card never gives away a hidden piece.
 */
export function getForcedPawnCaptures(state: GameState, color: Color): Array<{ from: Square; to: Square }> {
  const captures: Array<{ from: Square; to: Square }> = [];
  const visible = getVisibleSquares(state, color);
  for (const piece of state.pieces.values()) {
    if (piece.color !== color || piece.type !== 'pawn') continue;
    for (const to of getLegalMovesForPiece(state, piece)) {
      if (!isPawnCaptureTarget(state, piece.square, to)) continue;
      if (visible && !visible.has(to)) continue;
      const legal = isPromotionMove(state, piece.square, to)
        ? getValidPromotionTypes(state, piece.square, to).length > 0
        : validateMove(state, { ...buildMove(state, piece.square, to), playerColor: color }).valid;
      if (legal) captures.push({ from: piece.square, to });
    }
  }
  return captures;
}

/** True when the card binds `color` this turn: it owns the card, is not in check, and a pawn can capture. */
export function isUnderPeerPressure(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

/** MOD-B019 Peer Pressure: if one of your pawns can capture, you must make a pawn capture. */
export const peerPressureDef: ModifierDefinition = {
  id: ID,
  name: 'Peer Pressure',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),
};
