import { describe, expect, it } from 'vitest';
import { isGeneratedName, randomGuestName } from '../profile';

describe('randomGuestName', () => {
  it('fits the 20 character display name limit, even at its longest', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const name = randomGuestName(() => roll);
      expect(name.length).toBeLessThanOrEqual(20);
      expect(name).toMatch(/^[A-Za-z]+\d{4}$/);
    }
  });
});

describe('isGeneratedName', () => {
  it('spots guest names and the old default, not names a player picked', () => {
    expect(isGeneratedName(randomGuestName())).toBe(true);
    expect(isGeneratedName('Player')).toBe(true);
    expect(isGeneratedName('TundraGhost')).toBe(false);
    expect(isGeneratedName('SneakyBeak')).toBe(false);
  });
});
