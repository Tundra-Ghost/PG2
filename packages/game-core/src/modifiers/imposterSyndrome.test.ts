import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { validateMove } from '../engine/moveValidator';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { isQueenDoubting } from './definitions/imposter-syndrome';
import { makeEmptyState, makePiece, move } from './testHelpers';

const IMPOSTER = MODIFIER_IDS.imposterSyndrome;

function withImposter(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: IMPOSTER, sourceColor: 'white' }, ...extra]);
}

describe('MOD-B014 Imposter Syndrome', () => {
  it('after the Queen captures, her next move is one square; then she is normal again', () => {
    let state = withImposter([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('rook', 'black', 'd5'),
      makePiece('pawn', 'black', 'h7'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    expect(state.pieces.get('d5')!.isDoubting).toBe(true);
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    expect(isQueenDoubting(state, 'white')).toBe(true);
    expect(validateMove(state, move('d5', 'd8', 'white')).valid).toBe(false);
    expect(validateMove(state, move('d5', 'e6', 'white')).valid).toBe(true);
    // Other pieces move freely, and the doubt stays until she moves.
    expect(validateMove(state, move('a1', 'b1', 'white')).valid).toBe(true);
    state = chessEngine.applyMove(state, move('d5', 'd6', 'white'));
    expect(state.pieces.get('d6')!.isDoubting).toBe(false);
    state = chessEngine.applyMove(state, move('h6', 'h5', 'black'));
    expect(validateMove(state, move('d6', 'd1', 'white')).valid).toBe(true);
  });

  it('a one-square capture keeps her doubting', () => {
    let state = withImposter([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('rook', 'black', 'd5'),
      makePiece('knight', 'black', 'e6'),
      makePiece('pawn', 'black', 'h7'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    state = chessEngine.applyMove(state, move('d5', 'e6', 'white'));
    expect(state.pieces.get('e6')!.isDoubting).toBe(true);
  });

  it('does not apply in check', () => {
    let state = withImposter([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('rook', 'black', 'd5'),
      makePiece('rook', 'black', 'h2'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    // Black checks along the first rank; the Queen may block from far away.
    state = chessEngine.applyMove(state, move('h2', 'h1', 'black'));
    expect(validateMove(state, move('d5', 'd1', 'white')).valid).toBe(true);
  });

  it('only curses its owner, and a pawn that promotes with a capture is not doubted', () => {
    let state = withImposter([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'b7'),
      makePiece('rook', 'black', 'c8'),
      makePiece('queen', 'black', 'h5'),
      makePiece('pawn', 'white', 'h2'),
      makePiece('king', 'black', 'e8'),
    ]);
    state = chessEngine.applyMove(state, move('b7', 'c8', 'white', { promotion: 'queen' }));
    expect(state.pieces.get('c8')).toMatchObject({ type: 'queen' });
    expect(state.pieces.get('c8')!.isDoubting).toBeFalsy();
    state = chessEngine.applyMove(state, move('h5', 'h2', 'black'));
    expect(state.pieces.get('h2')!.isDoubting).toBeFalsy();
  });

  it('with Main Character Syndrome she must move, but only a little', () => {
    let state = withImposter(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('queen', 'white', 'd1'),
        makePiece('rook', 'black', 'd5'),
        makePiece('pawn', 'black', 'h7'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.mainCharacterSyndrome, sourceColor: 'white' }],
    );
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    // Both rules may bind; a far Queen move is never allowed.
    expect(validateMove(state, move('d5', 'd8', 'white')).valid).toBe(false);
    expect(validateMove(state, move('d5', 'd6', 'white')).valid).toBe(true);
  });
});
