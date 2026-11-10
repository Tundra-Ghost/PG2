import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { makeEmptyState, makePiece } from '../modifiers/testHelpers';
import { botView, getChickBotMove, getPigeonBotMove } from './bot';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };

function setup() {
  const state = makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('rook', 'white', 'a1'),
    makePiece('king', 'black', 'h8'),
    makePiece('queen', 'black', 'a8'),
    makePiece('pawn', 'white', 'b7'),
  ]);
  state.turn = 'black';
  return state;
}

describe('bots under fog', () => {
  it('take hidden enemy pieces off their view, but keep kings', () => {
    const state = setup();
    state.activeModifiers = [dark];
    const view = botView(state, 'black');
    expect(view.pieces.has('a1')).toBe(false);
    expect(view.pieces.get('h1')?.type).toBe('king');
    expect(state.pieces.has('a1')).toBe(true);
  });

  it('do not grab a piece they cannot see', () => {
    const open = setup();
    expect(getChickBotMove(open, 'black')).toMatchObject({ from: 'a8', to: 'a1' });
    expect(getPigeonBotMove(open, 'black', { depth: 1 })).toMatchObject({ from: 'a8', to: 'a1' });
    const fogged = setup();
    fogged.activeModifiers = [dark];
    // The rook on a1 is in the dark, so the pawn next to the queen is the best it sees.
    expect(getChickBotMove(fogged, 'black')).toMatchObject({ from: 'a8', to: 'b7' });
    expect(getPigeonBotMove(fogged, 'black', { depth: 1 })).toMatchObject({ from: 'a8', to: 'b7' });
  });
});
