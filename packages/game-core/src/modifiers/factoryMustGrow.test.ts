import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.factoryMustGrow;

function start(pieces: Piece[], extra: string[] = []): GameState {
  const picks = [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const }));
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), picks));
}

/** Plays one full round of King shuffles (a1-b1, h8-g8). */
function round(state: GameState): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  for (let i = 0; i < 2; i++) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const at = (state: GameState, sq: Square) => state.pieces.get(sq);
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-A010 The Factory Must Grow', () => {
  it('moves rank 4 right and rank 5 left at the end of each round, not before', () => {
    let state = start([...KINGS(), makePiece('knight', 'white', 'c4'), makePiece('bishop', 'black', 'f5')]);
    expect(at(state, 'c4')?.type).toBe('knight');
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    expect(at(state, 'c4')?.type).toBe('knight'); // mid-round: no move yet
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'd4')?.type).toBe('knight');
    expect(at(state, 'e5')?.type).toBe('bishop');
    expect(state.eventHistory.some(e => e.modifierId === ID)).toBe(true);
  });

  it('a line of pieces moves together; a piece stops at the edge or behind a stuck piece', () => {
    let state = start([...KINGS(), makePiece('pawn', 'white', 'f4'), makePiece('pawn', 'white', 'g4'), makePiece('rook', 'black', 'h4'), makePiece('pawn', 'black', 'c4'), makePiece('pawn', 'black', 'd4')]);
    state = round(state);
    expect(at(state, 'h4')?.type).toBe('rook'); // edge
    expect(at(state, 'g4')?.type).toBe('pawn'); // behind the rook
    expect(at(state, 'f4')?.type).toBe('pawn');
    expect(at(state, 'e4')?.color).toBe('black');
    expect(at(state, 'd4')?.color).toBe('black');
    expect(at(state, 'c4')).toBeUndefined();
  });

  it('never captures', () => {
    let state = start([...KINGS(), makePiece('rook', 'white', 'b5'), makePiece('pawn', 'black', 'a5')]);
    state = round(state);
    expect(at(state, 'b5')?.type).toBe('rook');
    expect(at(state, 'a5')?.color).toBe('black');
  });

  it('a King rides only to a safe square', () => {
    // White King on c4 would slide to d4, which the black rook on d8 attacks.
    let state = start([makePiece('king', 'white', 'c4'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'd8'), makePiece('pawn', 'white', 'a2')]);
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'c4')?.type).toBe('king');
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
  });

  it('a piece shielding a King from check stays put', () => {
    // The white knight on d4 shields its King on d1 from the rook on d8. The belt would move it off the file.
    let state = start([makePiece('king', 'white', 'd1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'd8'), makePiece('knight', 'white', 'd4'), makePiece('pawn', 'white', 'a2')]);
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'd4')?.type).toBe('knight');
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
  });

  it('stops while Tide Goes In floods ranks 4 and 5', () => {
    let state = start([...KINGS(), makePiece('pawn', 'white', 'h2')], [MODIFIER_IDS.tideGoesIn]);
    while (state.turnNumber < 17) state = round(state);
    const knight = makePiece('knight', 'white', 'c4');
    state = { ...state, pieces: new Map(state.pieces).set('c4', knight) };
    state = round(state); // turn 19: still flooded
    expect(at(state, 'c4')?.type).toBe('knight');
    while (state.turnNumber < 23) state = round(state);
    expect(at(state, 'c4')?.type).toBe('knight');
    state = round(state); // turn 25: the tide is out and the belt runs again
    expect(at(state, 'd4')?.type).toBe('knight');
  });
});
