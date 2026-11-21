import { describe, expect, it } from 'vitest';
import { chessEngine } from './ChessEngine';
import { positionKey } from './gameLoop';
import { makeEmptyState, makePiece, move } from '../modifiers/testHelpers';
import type { Piece } from './types';

/** Plain-chess draw and end rules that are easy to break by accident. */

const kings = (): Piece[] => [makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8')];

function statusAfterPass(extra: Piece[]) {
  const next = chessEngine.passTurn(makeEmptyState([...kings(), ...extra]));
  return next.status === 'draw' ? `draw:${next.drawReason}` : next.status;
}

describe('insufficient material', () => {
  it('King and one minor piece against a lone King is a draw', () => {
    expect(statusAfterPass([makePiece('knight', 'white', 'g1')])).toBe('draw:insufficient');
    expect(statusAfterPass([makePiece('bishop', 'black', 'c8')])).toBe('draw:insufficient');
  });

  it('bishops on the same colour are a draw, on opposite colours they are not', () => {
    // c1 and f8 are both dark squares; c8 is light.
    expect(statusAfterPass([makePiece('bishop', 'white', 'c1'), makePiece('bishop', 'black', 'f8')])).toBe('draw:insufficient');
    expect(statusAfterPass([makePiece('bishop', 'white', 'c1'), makePiece('bishop', 'black', 'c8')])).toBe('active');
  });

  it('a pawn, a rook or two knights can still mate, so play goes on', () => {
    expect(statusAfterPass([makePiece('pawn', 'white', 'a2')])).toBe('active');
    expect(statusAfterPass([makePiece('rook', 'white', 'a1')])).toBe('active');
    expect(statusAfterPass([makePiece('knight', 'white', 'g1'), makePiece('knight', 'white', 'b1')])).toBe('active');
    // A knight each is not a forced draw either.
    expect(statusAfterPass([makePiece('knight', 'white', 'g1'), makePiece('knight', 'black', 'g8')])).toBe('active');
  });
});

describe('50-move rule', () => {
  const withMaterial = () =>
    makeEmptyState([...kings(), makePiece('rook', 'white', 'a1'), makePiece('pawn', 'white', 'h2'), makePiece('knight', 'black', 'b8')]);

  it('a pawn move resets the clock', () => {
    const state = withMaterial();
    state.flags.halfMoveClock = 99;
    const next = chessEngine.applyMove(state, move('h2', 'h3', 'white'));
    expect(next.status).toBe('active');
    expect(next.flags.halfMoveClock).toBe(0);
  });

  it('a capture resets the clock', () => {
    const state = withMaterial();
    state.pieces.set('a8', makePiece('knight', 'black', 'a8'));
    state.flags.halfMoveClock = 99;
    const next = chessEngine.applyMove(state, move('a1', 'a8', 'white'));
    expect(next.status).toBe('active');
    expect(next.flags.halfMoveClock).toBe(0);
  });

  it('any other move on the 100th half-move draws', () => {
    const state = withMaterial();
    state.flags.halfMoveClock = 99;
    const next = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    expect(next.status).toBe('draw');
    expect(next.drawReason).toBe('50-move');
  });

  it('checkmate on the 100th half-move is still checkmate', () => {
    // Back-rank mate: Ra1-a8 with the black King boxed in by its own pawns.
    const state = makeEmptyState([
      makePiece('king', 'white', 'g1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'g8'),
      makePiece('pawn', 'black', 'f7'),
      makePiece('pawn', 'black', 'g7'),
      makePiece('pawn', 'black', 'h7'),
    ]);
    state.flags.halfMoveClock = 99;
    const next = chessEngine.applyMove(state, move('a1', 'a8', 'white'));
    expect(next.status).toBe('checkmate');
  });
});

describe('threefold repetition', () => {
  it('a position with castling rights is not the same as one without', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'e8'),
      makePiece('knight', 'black', 'g8'),
    ]);
    state.flags.castlingRights.white.kingSide = true;
    state.positionHistory = { [positionKey(state)]: 1 };

    const cycle = () => {
      state = chessEngine.applyMove(state, move('e1', 'f1', 'white'));
      state = chessEngine.applyMove(state, move('g8', 'h6', 'black'));
      state = chessEngine.applyMove(state, move('f1', 'e1', 'white'));
      state = chessEngine.applyMove(state, move('h6', 'g8', 'black'));
    };
    cycle();
    cycle();
    // Same squares as the start three times, but the start still had castling rights.
    expect(state.flags.castlingRights.white.kingSide).toBe(false);
    expect(state.status).toBe('active');
    cycle();
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('threefold');
  });
});
