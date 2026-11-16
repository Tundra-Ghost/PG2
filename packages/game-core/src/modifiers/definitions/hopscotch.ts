import type { ModifierDefinition } from '../types';
import { MODIFIER_IDS } from '../ids';
import { replaceOneRook } from './overseas-hire';

/**
 * MOD-E012 Hopscotch: one random rook of the owner becomes a Grasshopper.
 * Along any queen line it hops the first piece and lands right behind it,
 * capturing an enemy there. The move code is shared with the Cannon in
 * engine/hops.ts.
 */
export const hopscotchDef: ModifierDefinition = {
  id: MODIFIER_IDS.hopscotch,
  name: 'Hopscotch',
  category: 'E',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    return replaceOneRook(state, MODIFIER_IDS.hopscotch, 'grasshopper');
  },
};
