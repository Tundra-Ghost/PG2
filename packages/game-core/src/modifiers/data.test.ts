import { describe, expect, it } from 'vitest';
import './index';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';

describe('modifier card data', () => {
  it('gives every playable modifier a prototype rules line', () => {
    const missing = modifierRegistry
      .getAll()
      .map(def => ALL_MODIFIERS.find(card => card.id === def.id))
      .filter(card => !card?.prototypeRules?.trim())
      .map(card => card?.id);

    expect(missing).toEqual([]);
  });
});
