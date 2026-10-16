import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS, isSharedDraftModifier, modifierRegistry } from '@pigeon-chess/game-core';
import { BUDGET, MAX_COUNT, MAX_PER_CATEGORY, getSelectedCards, getValidOptions, runRandomDraft } from './draftRules';

const implemented = new Set(modifierRegistry.getAll().map(mod => mod.id));

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('runRandomDraft', () => {
  it('fills both drafts within the rules until no pick is left', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { playerIds, botIds } = runRandomDraft([], [], implemented, seeded(seed));
      for (const [own, other] of [[playerIds, botIds], [botIds, playerIds]]) {
        const cards = getSelectedCards(own);
        expect(own.length).toBeGreaterThan(0);
        expect(own.length).toBeLessThanOrEqual(MAX_COUNT);
        expect(new Set(own).size).toBe(own.length);
        expect(cards.reduce((sum, card) => sum + card.cost, 0)).toBeLessThanOrEqual(BUDGET);
        for (const category of 'ABCDE') {
          expect(cards.filter(card => card.category === category).length).toBeLessThanOrEqual(MAX_PER_CATEGORY);
        }
        expect(own.every(id => implemented.has(id))).toBe(true);
        expect(own.some(id => isSharedDraftModifier(id) && other.includes(id))).toBe(false);
        expect(getValidOptions(own, other, implemented)).toEqual([]);
      }
    }
  });

  it('only picks real cards', () => {
    const { playerIds } = runRandomDraft([], [], implemented, seeded(7));
    expect(playerIds.every(id => ALL_MODIFIERS.some(card => card.id === id))).toBe(true);
  });
});
