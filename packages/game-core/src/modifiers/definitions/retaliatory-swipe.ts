import type { ModifierDefinition } from '../types';
import type { Square } from '../../engine/types';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.retaliatorySwipe;
const FILES = 'abcdefgh';

/** MOD-C004: once every 4 turns, a pawn captures diagonally backwards. */
export const retaliatorySwipeDef: ModifierDefinition = {
  id: ID,
  name: 'Retaliatory Swipe',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Swipe back',
    hint: 'This pawn captures diagonally backwards this turn. No promotion.',
    pieceTypes: ['pawn'],
    cooldown: 4,
    getTargets(state, piece) {
      const back = piece.color === 'white' ? -1 : 1;
      const f = FILES.indexOf(piece.square[0]);
      const r = Number(piece.square[1]) + back;
      if (r < 1 || r > 8) return [];
      const targets: Square[] = [];
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const sq = `${FILES[f + df]}${r}` as Square;
        const occupant = state.pieces.get(sq);
        if (occupant && occupant.color !== piece.color) targets.push(sq);
      }
      return targets;
    },
  },
};
