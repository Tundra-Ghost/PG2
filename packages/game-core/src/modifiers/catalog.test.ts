import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import { getDraftScope } from './scope';
import { getValidOptions, runRandomDraft } from '../draft/rules';
import { seededRandom } from '../index';
import '../modifiers/index';

const built = new Set(modifierRegistry.getAll().map(def => def.id));
const designs = ALL_MODIFIERS.filter(card => !built.has(card.id));

describe('modifier catalogue', () => {
  it('has 100 cards, 20 per category, with unique ids and names', () => {
    expect(ALL_MODIFIERS).toHaveLength(100);
    for (const cat of ['A', 'B', 'C', 'D', 'E']) {
      expect(ALL_MODIFIERS.filter(card => card.category === cat), cat).toHaveLength(20);
    }
    expect(new Set(ALL_MODIFIERS.map(card => card.id)).size).toBe(100);
    expect(new Set(ALL_MODIFIERS.map(card => card.name)).size).toBe(100);
  });

  it('keeps every card inside the draft limits: cost -3 to 5, curse 0 to 3', () => {
    for (const card of ALL_MODIFIERS) {
      expect(card.cost, card.id).toBeGreaterThanOrEqual(-3);
      expect(card.cost, card.id).toBeLessThanOrEqual(5);
      expect(card.curseLevel, card.id).toBeGreaterThanOrEqual(0);
      expect(card.curseLevel, card.id).toBeLessThanOrEqual(3);
    }
  });

  it('prices curses by what they take: every Cursed card grants points', () => {
    for (const card of ALL_MODIFIERS.filter(c => c.category === 'B' && c.curseLevel > 0)) {
      expect(card.cost, card.id).toBeLessThan(0);
    }
  });

  it('gives every design card a scope', () => {
    for (const card of designs) {
      expect(card.scope, card.id).toBeDefined();
      expect(getDraftScope(card.id), card.id).toBe(card.scope === 'shared' ? 'shared' : 'owned');
    }
  });

  it('never offers a card that is not built, even in a full random draft', () => {
    expect(designs.length).toBeGreaterThan(0);
    const offered = getValidOptions([], [], built, { unlimited: true }).map(card => card.id);
    for (const card of designs) expect(offered, card.id).not.toContain(card.id);
    for (let seed = 1; seed <= 25; seed++) {
      const { playerIds, botIds } = runRandomDraft([], [], built, seededRandom(seed));
      for (const id of [...playerIds, ...botIds]) expect(built.has(id), id).toBe(true);
    }
  });
});
