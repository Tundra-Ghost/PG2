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

  it('does not hide the opponent\'s own moves, and changes no rules', () => {
    let s = chessEngine.applyMove(setup(), move('a1', 'a2', 'white'));
    s = chessEngine.applyMove(s, move('a5', 'b3', 'black'));
    expect(getShownNotation(s, s.moveHistory[1], 'white')).toBe('Nb3');
    expect(s.pieces.get('b3')?.type).toBe('knight');
  });
});
