import type { ModifierDefinition } from '../types';
import { appendGameEvent, applyMoveInternal, buildMove, cloneState } from '../../engine/gameLoop';
import { getBestCaptureTarget } from './berserker';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.rejectQueen;

export const rejectQueenDef: ModifierDefinition = {
  id: ID,
  name: 'Reject Queen, Embrace Knight',
  category: 'E',
  pointCost: 2,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onPreMoveValidate(state, move) {
    if (move.promotion !== 'queen') return { blocked: false };
    if (!affectsColor(state, ID, move.playerColor)) return { blocked: false };
    return { blocked: true, reason: 'Reject Queen: promote to a knight, bishop or rook.' };
  },

  onPromotion(state, move) {
    if (!affectsColor(state, ID, move.playerColor)) return state;
    const promoted = state.pieces.get(move.to);
    if (!promoted) return state;
    const next = cloneState(state);
    next.pieces.set(move.to, { ...promoted, hasPromotionChain: true });
    return next;
  },

  // onCapture runs before onPromotion, so a capturing promotion does not
  // spend the charge. The chain fires on the promoted piece's next capture.
  onCapture(state, move) {
    const piece = state.pieces.get(move.to);
    if (!piece?.hasPromotionChain) return state;

    let next = cloneState(state);
    next.pieces.set(move.to, { ...piece, hasPromotionChain: false });

    const chainTo = getBestCaptureTarget(next, move.to);
    if (!chainTo) return next;

    const target = next.pieces.get(chainTo)!;
    next = applyMoveInternal(next, buildMove(next, move.to, chainTo));
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Underpromotion',
      message: `The promoted ${piece.color} ${piece.type} chains from ${move.to} to ${chainTo}, capturing the ${target.color} ${target.type}.`,
    });
  },
};
