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

  it('uses the draft card name in the match', () => {
    // The draft shows card names, the match shows definition names.
    // They must match so players recognise what they drafted.
    const mismatched = modifierRegistry
      .getAll()
      .map(def => ({ id: def.id, match: def.name, card: ALL_MODIFIERS.find(card => card.id === def.id)?.name }))
      .filter(({ match, card }) => match !== card);

    expect(mismatched).toEqual([]);
  });
});
