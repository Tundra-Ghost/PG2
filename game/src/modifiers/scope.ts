import type { ModifierID } from '../engine/types';

export type DraftScope = 'shared' | 'owned';

const SHARED_MODIFIER_IDS = new Set<ModifierID>([
  'MOD-A002',
  'MOD-A004',
]);

export function getDraftScope(id: ModifierID): DraftScope {
  return SHARED_MODIFIER_IDS.has(id) ? 'shared' : 'owned';
}

export function isSharedDraftModifier(id: ModifierID): boolean {
  return getDraftScope(id) === 'shared';
}
