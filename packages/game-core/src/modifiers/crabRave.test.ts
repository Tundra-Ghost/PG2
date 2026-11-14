import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { buildMove } from '../engine/gameLoop';
import { getLegalMovesForPiece } from '../engine/moveGenerator';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const CRAB = MODIFIER_IDS.crabRave;

function withCrab(pieces: Piece[], owner: 'white' | 'black' = 'white', kings = true): GameState {
  const base = kings ? [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'h8')] : [];
  return chessEngine.activateDraftModifiers(makeEmptyState([...base, ...pieces]), [{ id: CRAB, sourceColor: owner }]);
}

function movesFrom(state: GameState, sq: Square): Square[] {
  return getLegalMovesForPiece(state, state.pieces.get(sq)!).sort();
}

describe('MOD-E014 Crab Rave', () => {
  it('lets the owner\'s pawns step one square sideways', () => {
    let state = withCrab([makePiece('pawn', 'white', 'd4')]);
    expect(movesFrom(state, 'd4')).toEqual(['c4', 'd5', 'e4']);
    state = chessEngine.applyMove(state, move('d4', 'e4', 'white'));
    expect(state.pieces.get('e4')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.turn).toBe('black');
  });

  it('works for black, and not for the other side', () => {
    const state = withCrab([makePiece('pawn', 'black', 'c5'), makePiece('pawn', 'white', 'f3')], 'black');
    expect(movesFrom(state, 'c5')).toEqual(['b5', 'c4', 'd5']);
    expect(movesFrom(state, 'f3')).toEqual(['f4']);
  });

  it('never captures sideways and stops at the board edge', () => {
    const state = withCrab([makePiece('pawn', 'white', 'a4'), makePiece('knight', 'black', 'b4')]);
    expect(movesFrom(state, 'a4')).toEqual(['a5']);
    expect(chessEngine.validateMove(state, move('a4', 'b4', 'white')).valid).toBe(false);
  });

  it('still captures diagonally forward', () => {
    const state = withCrab([makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'e5')]);
    expect(movesFrom(state, 'd4')).toEqual(['c4', 'd5', 'e4', 'e5']);
  });

  it('a sideways step onto the en passant square is a plain step, not a capture', () => {
    let state = withCrab([makePiece('pawn', 'white', 'e6'), makePiece('pawn', 'black', 'd7')]);
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    expect(state.flags.enPassantSquare).toBe('d6');
    state = chessEngine.applyMove(state, buildMove(state, 'e6', 'd6'));
    expect(state.pieces.get('d5')).toMatchObject({ type: 'pawn', color: 'black' });
    expect(state.pieces.get('d6')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.moveHistory[state.moveHistory.length - 1].pieceCaptured).toBeUndefined();
  });

  it('gives no en passant and does not reset the 50-move count', () => {
    let state = withCrab([makePiece('pawn', 'white', 'd4')]);
    state.flags.halfMoveClock = 10;
    state = chessEngine.applyMove(state, move('d4', 'e4', 'white'));
    expect(state.flags.enPassantSquare).toBeNull();
    expect(state.flags.halfMoveClock).toBe(11);
  });

  it('may not leave the King in check', () => {
    // The d4 pawn shields the king on c3 from the bishop on f6.
    const state = withCrab([
      makePiece('king', 'white', 'c3'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('bishop', 'black', 'f6'),
    ], 'white', false);
    expect(chessEngine.validateMove(state, move('d4', 'e4', 'white'))).toEqual({ valid: false, reason: 'leaves king in check' });
    expect(chessEngine.validateMove(state, move('d4', 'c4', 'white')).valid).toBe(false);
  });

  it('may step sideways to block a check', () => {
    const state = withCrab([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('rook', 'black', 'e8'),
    ], 'white', false);
    expect(chessEngine.validateMove(state, move('d4', 'e4', 'white')).valid).toBe(true);
  });

  it('cannot step onto a void square', () => {
    const state = withCrab([makePiece('pawn', 'white', 'd4')]);
    state.tiles.set('e4', { square: 'e4', effects: [], isVoid: true });
    expect(movesFrom(state, 'd4')).toEqual(['c4', 'd5']);
  });

  it('sideways shuffles end in a repetition draw, so no softlock', () => {
    let state = withCrab([makePiece('pawn', 'white', 'd4')]);
    for (let i = 0; i < 12 && state.status === 'active'; i++) {
      state = chessEngine.applyMove(state, move(i % 2 ? 'e4' : 'd4', i % 2 ? 'd4' : 'e4', 'white'));
      if (state.status !== 'active') break;
      state = chessEngine.applyMove(state, move(i % 2 ? 'g8' : 'h8', i % 2 ? 'h8' : 'g8', 'black'));
    }
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('threefold');
  });

  it('a pawn in the Swamp may step sideways, one square', () => {
    let state = withCrab([makePiece('pawn', 'white', 'd4')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    expect(chessEngine.validateMove(state, move('d4', 'c4', 'white')).valid).toBe(true);
  });
});
