import type { ModifierDefinition } from '../types';
import { cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.chancellor;

export const chancellorDef: ModifierDefinition = {
  id: ID,
  name: 'Equivalent Exchange',
  category: 'E',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  // One random rook of the owner becomes The Chancellor (rook + knight moves).
  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors = owner ? [owner] : (['white', 'black'] as const);
    const next = cloneState(state);

    for (const color of colors) {
      const rooks = Array.from(next.pieces.values()).filter(p => p.color === color && p.type === 'rook');
      if (rooks.length === 0) continue;
      const [idx, prng] = prngPickIndex(next.prngState, rooks.length);
      next.prngState = prng;
      const rook = rooks[idx];
      next.pieces.set(rook.square, { ...rook, type: 'chancellor' });

      // Castling needs a rook in the corner; the Chancellor cannot castle.
      const homeRank = color === 'white' ? '1' : '8';
      if (rook.square === `h${homeRank}`) next.flags.castlingRights[color].kingSide = false;
      if (rook.square === `a${homeRank}`) next.flags.castlingRights[color].queenSide = false;
    }
    return next;
  },
};
