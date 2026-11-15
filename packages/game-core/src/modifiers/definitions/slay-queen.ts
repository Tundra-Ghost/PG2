import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.slayQueen;

/**
 * MOD-E009 Slay Queen: the owner's Queen becomes The Amazon. She keeps every
 * queen move and also jumps like a knight (see moveGenerator). Only the
 * starting Queen is an Amazon; a pawn that promotes later is a plain queen.
 */
export const slayQueenDef: ModifierDefinition = {
  id: ID,
  name: 'Slay Queen (The Amazon)',
  category: 'E',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const piece of next.pieces.values()) {
      if (piece.type === 'queen' && colors.includes(piece.color)) {
        next.pieces.set(piece.square, { ...piece, isAmazon: true });
      }
    }
    return next;
  },
};
