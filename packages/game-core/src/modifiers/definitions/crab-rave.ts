import type { ModifierDefinition } from '../types';
import { MODIFIER_IDS } from '../ids';

/**
 * MOD-E014: the owner's pawns may also step one square sideways onto an
 * empty square. The move generator adds the step (engine/moveGenerator.ts),
 * so check, stalemate and the bot all see it. Captures stay diagonal.
 */
export const crabRaveDef: ModifierDefinition = {
  id: MODIFIER_IDS.crabRave,
  name: 'Crab Rave',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
