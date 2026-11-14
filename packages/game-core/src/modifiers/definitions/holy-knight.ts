import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.holyKnight;

/**
 * MOD-E010 Holy Knight: one random bishop of the owner becomes an Archbishop
 * (bishop + knight moves). Ghost bishops (MOD-D002) are never picked.
 */
export const holyKnightDef: ModifierDefinition = {
  id: ID,
  name: 'Holy Knight (The Archbishop)',
  category: 'E',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const color of colors) {
      const bishops = Array.from(next.pieces.values()).filter(p => p.color === color && p.type === 'bishop' && !p.isGhost);
      if (bishops.length === 0) continue;
      const [idx, prng] = prngPickIndex(next.prngState, bishops.length);
      next.prngState = prng;
      const bishop = bishops[idx];
      next.pieces.set(bishop.square, { ...bishop, type: 'archbishop' });
    }
    return next;
  },
};
