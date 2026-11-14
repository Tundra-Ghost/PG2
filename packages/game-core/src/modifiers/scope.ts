import type { ModifierID } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { modifierRegistry } from './registry';
import { ALL_MODIFIERS } from './data';

export type DraftScope = 'shared' | 'owned';

const SHARED_MODIFIER_IDS = new Set<ModifierID>([
  MODIFIER_IDS.floorIsLava,
  MODIFIER_IDS.winterIsComing,
]);

export function getDraftScope(id: ModifierID): DraftScope {
  const registered = modifierRegistry.get(id)?.draftScope;
  if (registered) return registered;
  if (SHARED_MODIFIER_IDS.has(id)) return 'shared';
  // Design cards say in the bible whether they are shared.
  return ALL_MODIFIERS.find(card => card.id === id)?.scope === 'shared' ? 'shared' : 'owned';
}

export function isSharedDraftModifier(id: ModifierID): boolean {
  return getDraftScope(id) === 'shared';
}
