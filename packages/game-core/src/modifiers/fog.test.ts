import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { getVisibleSquares, isMoveHidden } from '../engine/visibility';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };

describe('It\'s Dark And I\'m Scared', () => {
  it('has no fog without the card', () => {
    expect(getVisibleSquares(chessEngine.getInitialState(), 'white')).toBeNull();
  });

  it('shows 2 squares around own pieces, plus pigeons', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pigeon', 'black', 'h1'),
    ]);
    state.activeModifiers = [dark];
    const visible = getVisibleSquares(state, 'white')!;
    expect(visible.has('c3')).toBe(true);
    expect(visible.has('d1')).toBe(false);
    expect(visible.has('h8')).toBe(false);
    expect(visible.has('h1')).toBe(true);
  });

  it('hides enemy moves that land in the dark', () => {
    const state = makeEmptyState([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')]);
    state.activeModifiers = [dark];
    const record = { move: move('h8', 'g8', 'black'), pieceMoved: makePiece('king', 'black', 'h8'), notation: 'Kg8' };
    expect(isMoveHidden(state, record, 'white')).toBe(true);
    expect(isMoveHidden(state, record, 'black')).toBe(false);
  });
});
