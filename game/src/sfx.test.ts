import { describe, expect, it } from 'vitest';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { getEventSound, pickEventSounds } from './sfx';

describe('modifier event sounds', () => {
  it('maps known events and falls back to a chime', () => {
    expect(getEventSound(MODIFIER_IDS.floorIsLava)).toBe('lava');
    expect(getEventSound(MODIFIER_IDS.forTheEmperor)).toBe('cannon');
    expect(getEventSound('MOD-X999')).toBe('chime');
  });

  it('keeps Reginald silent', () => {
    expect(getEventSound(MODIFIER_IDS.reginaldBeak)).toBeNull();
  });

  it('plays each sound once and at most two per move', () => {
    const lava = { modifierId: MODIFIER_IDS.floorIsLava };
    const berserker = { modifierId: MODIFIER_IDS.berserker };
    const gerald = { modifierId: MODIFIER_IDS.gerald };
    expect(pickEventSounds([lava, lava, berserker, gerald])).toEqual(['lava', 'berserker']);
  });
});
