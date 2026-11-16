import type { ModifierDefinition } from '../types';
import { MODIFIER_IDS } from '../ids';

/**
 * MOD-E018: the owner's pawns may move two squares forward from any rank.
 * The move generator adds the step (engine/moveGenerator.ts), and en passant
 * follows every two-square pawn move, so it works from any rank too.
 */
export const zergRushDef: ModifierDefinition = {
  id: MODIFIER_IDS.zergRush,
  name: 'Zerg Rush',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
