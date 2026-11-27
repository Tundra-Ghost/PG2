import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { getShownNotation } from './definitions/sus';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { chessEngine } from '../engine/ChessEngine';

function setup() {
  return chessEngine.activateDraftModifiers(makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('rook', 'white', 'a1'),
    makePiece('king', 'black', 'h8'),
    makePiece('knight', 'black', 'a5'),
  ]), [{ id: MODIFIER_IDS.pokerFace, sourceColor: 'white' }]);
}

describe('Poker Face', () => {
  it('shows the opponent only the destination square, never the piece or the capture', () => {
    const next = chessEngine.applyMove(setup(), move('a1', 'a5', 'white'));
    const record = next.moveHistory[0];
    expect(record.notation).toBe('Rxa5');
    expect(getShownNotation(next, record, 'black')).toBe('a5');
    expect(getShownNotation(next, record, 'white')).toBe('Rxa5');
  });

  it('keeps the check mark, which the board shows anyway', () => {
    const next = chessEngine.applyMove(setup(), move('a1', 'a8', 'white'));
    expect(getShownNotation(next, next.moveHistory[0], 'black')).toBe('a8+');
  });

  it('hides the promotion piece and keeps mate', () => {
    const mate = chessEngine.activateDraftModifiers(makeEmptyState([
      makePiece('king', 'white', 'g6'),
      makePiece('rook', 'white', 'a1'),
      makePiece('pawn', 'white', 'c7'),
      makePiece('king', 'black', 'h8'),
    ]), [{ id: MODIFIER_IDS.pokerFace, sourceColor: 'white' }]);
    const promoted = chessEngine.applyMove(mate, move('c7', 'c8', 'white', { promotion: 'queen' }));
    expect(getShownNotation(promoted, promoted.moveHistory[0], 'black')).toBe('c8#');
    const mated = chessEngine.applyMove(mate, move('a1', 'a8', 'white'));
    expect(getShownNotation(mated, mated.moveHistory[0], 'black')).toBe('a8#');
  });

  it('an ability keeps its squares but drops the piece letter', () => {
    const record = { move: { from: 'a4', to: 'f4', playerColor: 'white', ability: 'MOD-C001' }, pieceMoved: makePiece('rook', 'white', 'a4'), notation: 'Ra4*f4' } as const;
    const state = setup();
    expect(getShownNotation(state, record as never, 'black')).toBe('a4*f4');
  });

  it('does not hide the opponent\'s own moves, and changes no rules', () => {
    let s = chessEngine.applyMove(setup(), move('a1', 'a2', 'white'));
    s = chessEngine.applyMove(s, move('a5', 'b3', 'black'));
    expect(getShownNotation(s, s.moveHistory[1], 'white')).toBe('Nb3');
    expect(s.pieces.get('b3')?.type).toBe('knight');
  });
});
