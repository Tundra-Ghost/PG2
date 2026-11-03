import type { ModifierDefinition } from '../types';
import type { Square } from '../../engine/types';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.darkAndScared;
const FILES = 'abcdefgh';
/** How far each piece lights the board around it. */
export const DARK_VIEW_RANGE = 2;

/**
 * MOD-D001: each side sees only within 2 squares of its own pieces.
 * Pigeons are always visible.
 */
export const darkAndScaredDef: ModifierDefinition = {
  id: ID,
  name: 'It\'s Dark And I\'m Scared',
  category: 'D',
  pointCost: 4,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  getVisibleSquares(state, color) {
    // MOD-D006 Cat Mode: the owner sees one square further.
    const range = DARK_VIEW_RANGE + (affectsColor(state, MODIFIER_IDS.catMode, color) ? 1 : 0);
    const visible = new Set<Square>();
    for (const piece of state.pieces.values()) {
      if (piece.type === 'pigeon') visible.add(piece.square);
      if (piece.color !== color) continue;
      const f0 = FILES.indexOf(piece.square[0]);
      const r0 = Number(piece.square[1]);
      for (let f = f0 - range; f <= f0 + range; f++) {
        for (let r = r0 - range; r <= r0 + range; r++) {
          if (f >= 0 && f < 8 && r >= 1 && r <= 8) visible.add(`${FILES[f]}${r}` as Square);
        }
      }
    }
    return [...visible];
  },
};
