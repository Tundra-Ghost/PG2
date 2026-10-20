import type { Color, ModifierInstance } from '@pigeon-chess/game-core';
import { getDraftScope } from '@pigeon-chess/game-core';

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

// Tiers come from the modifier bible: S cards change the whole match,
// B cards are a light twist. Players never saw what the letter meant.
const TIER_MEANING: Record<string, string> = {
  S: 'match-changing',
  A: 'strong',
  B: 'light',
};

export function getTierLabel(tier: string): string {
  const meaning = TIER_MEANING[tier];
  return meaning ? `Tier ${tier}: ${meaning}` : `Tier ${tier}`;
}

export function getCurseLabel(level: number): string {
  return level === 0 ? 'No curse' : `Curse ${level} of 3`;
}
