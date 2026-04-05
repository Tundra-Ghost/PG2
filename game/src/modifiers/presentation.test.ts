import { describe, expect, it } from 'vitest';
import { getModifierDisplayBucket, getModifierOwnershipLabel } from './presentation';

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
});
