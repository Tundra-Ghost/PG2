import type { Color, ModifierInstance } from '../engine/types';
import { getDraftScope } from './scope';

export function getModifierDisplayBucket(
  modifier: ModifierInstance,
): Color | 'both' {
  if (getDraftScope(modifier.id) === 'shared') {
    return 'both';
  }

  return modifier.sourceColor ?? modifier.activeFor;
}

export function getModifierOwnershipLabel(modifier: ModifierInstance): string {
  if (getDraftScope(modifier.id) === 'shared') {
    return 'shared effect';
  }

  if (modifier.sourceColor) {
    return `${modifier.sourceColor} owned`;
  }

  return modifier.activeFor === 'both'
    ? 'shared effect'
    : `${modifier.activeFor} owned`;
}
