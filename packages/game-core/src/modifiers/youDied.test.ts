import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const YOU_DIED = MODIFIER_IDS.youDied;

function cursed(owner: 'white' | 'black'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'e8'),
      makePiece('rook', 'black', 'h8'),
    ]),
    [{ id: YOU_DIED, sourceColor: owner }],
  );
}

/** White's rook and black's rook walk without repeating a position. */
const WHITE_PATH: Square[] = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
const BLACK_PATH: Square[] = ['h8', 'h7', 'h6', 'h5', 'h4', 'h3', 'h2'];

describe('MOD-B001 YOU DIED (But A Piece Did)', () => {
  it('plays the owner 7th turn automatically and hands the turn back', () => {
    let state = cursed('white');
    for (let i = 0; i < 6; i++) {
      state = chessEngine.applyMove(state, move(WHITE_PATH[i], WHITE_PATH[i + 1], 'white'));
      // Black's 6th move hands white its 7th turn, which plays itself.
      state = chessEngine.applyMove(state, move(BLACK_PATH[i], BLACK_PATH[i + 1], 'black'));
    }
    expect(state.moveHistory).toHaveLength(13);
    expect(state.moveHistory[12].move.playerColor).toBe('white');
    expect(state.turn).toBe('black');
    expect(state.eventHistory.some(e => e.modifierId === YOU_DIED && e.title === 'A PIECE MOVED')).toBe(true);
  });

  it('never takes over the opponent', () => {
    let state = cursed('black');
    for (let i = 0; i < 6; i++) {
      state = chessEngine.applyMove(state, move(WHITE_PATH[i], WHITE_PATH[i + 1], 'white'));
      if (i < 5) state = chessEngine.applyMove(state, move(BLACK_PATH[i], BLACK_PATH[i + 1], 'black'));
    }
    // White's 6th move hands black its 6th turn: no takeover yet.
    expect(state.turn).toBe('black');
    expect(state.moveHistory).toHaveLength(11);
    state = chessEngine.applyMove(state, move('h3', 'h2', 'black'));
    expect(state.moveHistory).toHaveLength(12);
  });

  it('the automatic move is always legal', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let state = cursed('white');
      // White king in check from the black rook: the forced move must answer it.
      state.pieces.delete('h8');
      state.pieces.set('h7', makePiece('rook', 'black', 'h7'));
      state.prngState = seed;
      state.turnNumber = 12; // black to move; white's next turn is its 7th
      state.turn = 'black';
      const next = chessEngine.applyMove(state, move('h7', 'e7', 'black'));
      expect(next.moveHistory).toHaveLength(2);
      expect(chessEngine.isInCheck(next, 'white')).toBe(false);
    }
  });
});
