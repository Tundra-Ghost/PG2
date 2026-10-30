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

  it('keeps definition cost and curse equal to the draft card', () => {
    // The draft reads the card; the definition copy must not drift from it.
    const mismatched = modifierRegistry
      .getAll()
      .map(def => ({ id: def.id, def: [def.pointCost, def.curseRating], card: ALL_MODIFIERS.find(card => card.id === def.id) }))
      .filter(({ def, card }) => def[0] !== card?.cost || def[1] !== card?.curseLevel)
      .map(({ id }) => id);

    expect(mismatched).toEqual([]);
  });
});
