import type { ModifierDefinition } from '../types';
import { MODIFIER_IDS } from '../ids';

/**
 * MOD-E018: the owner's pawns may move two squares forward from any rank.
 * The move generator adds the step (engine/moveGenerator.ts). En passant only
 * follows a two-square move from the starting rank (engine/gameLoop.ts), so a
 * two-square move from any other rank cannot be taken en passant.
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
