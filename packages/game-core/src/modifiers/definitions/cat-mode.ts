import type { ModifierDefinition } from '../types';
import { MODIFIER_IDS } from '../ids';

/**
 * MOD-D006: the owner sees 1 square further in It's Dark And I'm Scared.
 * The draft only offers it once that card is picked (draft/rules.ts), and
 * the extra sight lives in dark-and-scared.ts.
 */
export const catModeDef: ModifierDefinition = {
  id: MODIFIER_IDS.catMode,
  name: 'Cat Mode (Night Vision)',
  category: 'D',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
