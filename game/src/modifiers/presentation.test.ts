import { describe, expect, it } from 'vitest';
import { getCurseLabel, getModifierDisplayBucket, getModifierOwnershipLabel, getTierLabel } from './presentation';
import { getDraftScope } from '@pigeon-chess/game-core';

describe('modifier presentation', () => {
  it('shows shared draft modifiers in the shared bucket even when drafted by a side', () => {
    const modifier = {
      id: 'MOD-A002',
      name: 'Floor is Lava',
      activeFor: 'both' as const,
      sourceColor: 'white' as const,
    };

    expect(getModifierDisplayBucket(modifier)).toBe('both');
    expect(getModifierOwnershipLabel(modifier)).toBe('shared effect');
  });

  it('shows owned modifiers under the drafting side bucket', () => {
    const modifier = {
      id: 'MOD-E006',
      name: 'Berserker',
      activeFor: 'both' as const,
      sourceColor: 'black' as const,
    };

    expect(getModifierDisplayBucket(modifier)).toBe('black');
    expect(getModifierOwnershipLabel(modifier)).toBe('black owned');
  });

  it('reads shared scope from the registered modifier definition for floor is lava', () => {
    expect(getDraftScope('MOD-A002')).toBe('shared');
  });

  it('explains tier letters and curse levels in words', () => {
    expect(getTierLabel('S')).toBe('Tier S: match-changing');
    expect(getTierLabel('A')).toBe('Tier A: strong');
    expect(getTierLabel('B')).toBe('Tier B: light');
    expect(getCurseLabel(0)).toBe('No curse');
    expect(getCurseLabel(2)).toBe('Curse 2 of 3');
  });
});
