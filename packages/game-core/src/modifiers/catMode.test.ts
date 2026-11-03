import { describe, expect, it } from 'vitest';
import './index';
import { getVisibleSquares } from '../engine/visibility';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece } from './testHelpers';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };
const cat = { id: MODIFIER_IDS.catMode, name: 'Cat Mode', activeFor: 'both' as const, sourceColor: 'white' as const };
const implemented = new Set(ALL_MODIFIERS.map(card => card.id));
const catCard = ALL_MODIFIERS.find(card => card.id === MODIFIER_IDS.catMode)!;

describe('Cat Mode', () => {
  it('lets its owner see 3 squares in the dark', () => {
    const state = makeEmptyState([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')]);
    state.activeModifiers = [dark, cat];
    expect(getVisibleSquares(state, 'white')!.has('d4')).toBe(true);
    expect(getVisibleSquares(state, 'white')!.has('e5')).toBe(false);
    expect(getVisibleSquares(state, 'black')!.has('e5')).toBe(false);
    expect(getVisibleSquares(state, 'black')!.has('f6')).toBe(true);
    expect(getVisibleSquares(state, 'black')!.has('e5')).toBe(false);
  });

  it('is only offered once It\'s Dark And I\'m Scared is in the draft', () => {
    const ids = (cards: { id: string }[]) => cards.map(card => card.id);
    expect(ids(getValidOptions([], [], implemented))).not.toContain(MODIFIER_IDS.catMode);
    expect(ids(getValidOptions([], [], implemented, { unlimited: true }))).not.toContain(MODIFIER_IDS.catMode);
    expect(pickBlocker(catCard, [], [], implemented)).toMatch(/Needs It's Dark/);
    expect(ids(getValidOptions([], [MODIFIER_IDS.darkAndScared], implemented))).toContain(MODIFIER_IDS.catMode);
    expect(pickBlocker(catCard, [MODIFIER_IDS.darkAndScared], [], implemented)).toBeNull();
  });
});
