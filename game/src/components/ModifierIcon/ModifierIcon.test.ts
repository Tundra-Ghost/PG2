import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS, modifierRegistry } from '@pigeon-chess/game-core';
import { hasModifierIcon } from './ModifierIcon';

const built = new Set(modifierRegistry.getAll().map(def => def.id));

describe('modifier icons', () => {
  it('has an icon for every built modifier and every category', () => {
    const missing = ALL_MODIFIERS.map(card => card.id).filter(id => built.has(id) && !hasModifierIcon(id));
    expect(missing).toEqual([]);
    for (const category of ['A', 'B', 'C', 'D', 'E']) {
      expect(hasModifierIcon(`category-${category}`)).toBe(true);
    }
  });

  it('shows design cards with their category mark until they get their own icon', () => {
    // A card's own icon is drawn when it is built; until then ModifierIcon
    // falls back to the category mark, which must exist for every category.
    for (const card of ALL_MODIFIERS.filter(c => !built.has(c.id))) {
      expect(hasModifierIcon(card.id) || hasModifierIcon(`category-${card.category}`), card.id).toBe(true);
    }
  });
});
