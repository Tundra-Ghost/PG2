import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { mirrorSquare } from './definitions/bandersnatch';
import { makeEmptyState, makePiece, move } from './testHelpers';

const card = { id: MODIFIER_IDS.bandersnatch, name: 'Bandersnatch', activeFor: 'both' as const, sourceColor: null };

function opening() {
  const state = chessEngine.getInitialState();
  state.activeModifiers = [card];
  return state;
}

describe('Bandersnatch Protocol', () => {
  it('mirrors squares across the d/e axis', () => {
    expect(mirrorSquare('c1')).toBe('f1');
    expect(mirrorSquare('h5')).toBe('a5');
  });

  it('makes the mirror twin copy the move', () => {
    let state = chessEngine.applyMove(opening(), move('b1', 'c3', 'white'));
    expect(state.pieces.get('c3')?.type).toBe('knight');
    expect(state.pieces.get('f3')?.type).toBe('knight');
    expect(state.pieces.has('g1')).toBe(false);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('Every choice echoes. The white knight on g1 moves to f3.');
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    expect(state.pieces.get('e5')?.type).toBe('pawn');
  });

  it('skips the echo when the twin cannot make the move', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('pawn', 'white', 'h3'),
      makePiece('king', 'black', 'e8'),
    ]);
    state.activeModifiers = [card];
    const next = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    expect(next.pieces.get('h1')?.type).toBe('rook');
    expect(next.pieces.has('h5')).toBe(false);
  });

  it('never moves a King', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [card];
    const next = chessEngine.applyMove(state, move('d1', 'd2', 'white'));
    expect(next.pieces.get('e1')?.type).toBe('king');
  });
});
