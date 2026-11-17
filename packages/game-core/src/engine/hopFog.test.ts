import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { makeEmptyState, makePiece } from '../modifiers/testHelpers';
import { chessEngine } from './ChessEngine';
import { getPigeonBotMove } from './bot';
import { isInCheck } from './moveGenerator';
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
    makePiece('queen', 'black', 'a6'), // hidden target past the screen
  ]);
  if (fog) state.activeModifiers = [dark];
  return state;
}

const move = (from: string, to: string) => ({ from, to, playerColor: 'white' }) as Parameters<typeof chessEngine.validateMove>[1];

describe('hops under fog (#157)', () => {
  it('a Grasshopper cannot hop a hidden piece, but can hop one in view', () => {
    const state = setup(true);
    const moves = chessEngine.getLegalMoves(state, 'd1');
    expect(moves).toContain('f3');
    expect(moves).not.toContain('d6');
    expect(isHopHidden(state, 'd1', 'd6')).toBe(true);
    expect(chessEngine.validateMove(state, move('d1', 'd6')).valid).toBe(false);
  });

  it('a Cannon cannot capture a hidden piece, and keeps its slides', () => {
    const state = setup(true);
    const moves = chessEngine.getLegalMoves(state, 'a1');
    expect(moves).toContain('b1');
    expect(moves).not.toContain('a6');
    expect(chessEngine.validateMove(state, move('a1', 'a6')).valid).toBe(false);
  });

  it('every hop is legal without fog', () => {
    const state = setup(false);
    expect(chessEngine.getLegalMoves(state, 'd1')).toContain('d6');
    expect(chessEngine.getLegalMoves(state, 'a1')).toContain('a6');
    expect(isHopHidden(state, 'd1', 'd6')).toBe(false);
  });

  it('threats still use the real board: a Cannon checks a King it cannot see', () => {
    const state = setup(true);
    state.pieces.delete('a6');
    state.pieces.delete('h8');
    state.pieces.set('a6', makePiece('king', 'black', 'a6'));
    expect(isInCheck(state, 'black')).toBe(true);
  });

  it('the bot does not take the hidden queen either', () => {
    const state = setup(true);
    expect(getPigeonBotMove(state, 'white', { depth: 1 })).not.toMatchObject({ from: 'a1', to: 'a6' });
    expect(getPigeonBotMove(setup(false), 'white', { depth: 1 })).toMatchObject({ from: 'a1', to: 'a6' });
  });
});
