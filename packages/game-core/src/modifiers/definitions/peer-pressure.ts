import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Square } from '../../engine/types';
import { buildMove, getValidPromotionTypes, isPromotionMove } from '../../engine/gameLoop';
import { getLegalMovesForPiece, isInCheck } from '../../engine/moveGenerator';
import { validateMove } from '../../engine/moveValidator';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.peerPressure;
const REASON = 'Peer Pressure: a pawn can capture, so you must capture with a pawn.';

/** A normal (not ability) pawn move to another file: a capture or en passant. */
function isPawnCapture(state: GameState, move: Move): boolean {
  if (move.ability) return false;
  const piece = state.pieces.get(move.from);
  return piece?.type === 'pawn' && move.from[0] !== move.to[0];
}

/**
 * Every pawn capture `color` may play now, after every other card and the
 * self-check rule have had their say. Pawn captures always pass this card's
 * own check, so asking validateMove here cannot loop. Under fog, only
 * captures onto squares `color` can see count, so the card never gives
 * away a hidden piece.
 */
export function getForcedPawnCaptures(state: GameState, color: Color): Array<{ from: Square; to: Square }> {
  const captures: Array<{ from: Square; to: Square }> = [];
  const visible = getVisibleSquares(state, color);
  for (const piece of state.pieces.values()) {
    if (piece.color !== color || piece.type !== 'pawn') continue;
    for (const to of getLegalMovesForPiece(state, piece)) {
      if (to[0] === piece.square[0]) continue;
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
  if (state.status !== 'active' || !affectsColor(state, ID, color)) return false;
  if (isInCheck(state, color)) return false;
  return getForcedPawnCaptures(state, color).length > 0;
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

  onPreMoveValidate(state, move) {
    if (isPawnCapture(state, move)) return { blocked: false };
    if (!isUnderPeerPressure(state, move.playerColor)) return { blocked: false };
    return { blocked: true, reason: REASON };
  },

  blocksPass(state) {
    return isUnderPeerPressure(state, state.turn) ? REASON : null;
  },
};
