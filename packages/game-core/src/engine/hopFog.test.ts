import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { makeEmptyState, makePiece } from '../modifiers/testHelpers';
import { chessEngine } from './ChessEngine';
import { botView } from './bot';
import { isHopHidden } from './visibility';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };

// Dark And Scared: white sees two squares around each of its pieces.
function setup(fog: boolean) {
  const state = makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('king', 'black', 'h8'),
    makePiece('grasshopper', 'white', 'd1'),
    makePiece('pawn', 'black', 'd5'), // hidden screen: the hop lands on d6
    makePiece('pawn', 'white', 'e2'), // seen screen: the hop lands on f3
    makePiece('cannon', 'white', 'a1'),
    makePiece('pawn', 'white', 'a2'), // the Cannon's screen
    makePiece('knight', 'black', 'a6'), // hidden target past the screen
  ]);
  if (fog) state.activeModifiers = [dark];
  return state;
}

describe('hops under fog (#157)', () => {
  it('hides a Grasshopper hop over a hidden piece, keeps one in view', () => {
    const state = setup(true);
    const moves = chessEngine.getLegalMoves(state, 'd1');
    expect(moves).toEqual(expect.arrayContaining(['d6', 'f3']));
    expect(isHopHidden(state, 'd1', 'd6')).toBe(true);
    expect(isHopHidden(state, 'd1', 'f3')).toBe(false);
  });

  it('hides a Cannon capture of a hidden piece, keeps its slides', () => {
    const state = setup(true);
    const moves = chessEngine.getLegalMoves(state, 'a1');
    expect(moves).toEqual(expect.arrayContaining(['a6', 'b1']));
    expect(isHopHidden(state, 'a1', 'a6')).toBe(true);
    expect(isHopHidden(state, 'a1', 'b1')).toBe(false);
  });

  it('shows every hop without fog', () => {
    const state = setup(false);
    expect(isHopHidden(state, 'd1', 'd6')).toBe(false);
    expect(isHopHidden(state, 'a1', 'a6')).toBe(false);
  });

  it('the bot plans on the same view: no hop over a hidden piece', () => {
    const view = botView(setup(true), 'white');
    expect(chessEngine.getLegalMoves(view, 'd1')).not.toContain('d6');
    expect(chessEngine.getLegalMoves(view, 'a1')).not.toContain('a6');
  });
});
