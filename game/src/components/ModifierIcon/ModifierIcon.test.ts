import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS } from '@pigeon-chess/game-core';
import { hasModifierIcon } from './ModifierIcon';

describe('modifier icons', () => {
  it('has an icon for every modifier and category', () => {
    const missing = ALL_MODIFIERS.map(card => card.id).filter(id => !hasModifierIcon(id));
    expect(missing).toEqual([]);
    for (const category of ['A', 'B', 'C', 'D', 'E']) {
      expect(hasModifierIcon(`category-${category}`)).toBe(true);
    }
  });
});
