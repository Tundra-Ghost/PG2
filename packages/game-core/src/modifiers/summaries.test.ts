import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS } from './data';
import { MODIFIER_SUMMARIES } from './summaries';

describe('modifier summaries', () => {
  it('gives every modifier one short plain line', () => {
    for (const card of ALL_MODIFIERS) {
      const summary = MODIFIER_SUMMARIES[card.id];
      expect(summary, card.id).toBeTruthy();
      expect(summary.length, card.id).toBeLessThanOrEqual(80);
    }
  });
});
