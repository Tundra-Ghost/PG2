import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.magicRoundabout;

function start(pieces: Piece[]): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }]));
}

/** One full round of King shuffles (a1-b1, h8-g8). */
function round(state: GameState): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  for (let i = 0; i < 2; i++) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const at = (state: GameState, sq: Square) => state.pieces.get(sq);
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'white', 'h2')];

describe('MOD-A013 The Magic Roundabout', () => {
  it('turns pieces one step clockwise at the end of each round, not before', () => {
    let state = start([...KINGS(), makePiece('knight', 'white', 'd4')]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    expect(at(state, 'd4')?.type).toBe('knight');
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'd5')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'e5')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'e4')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'd4')?.type).toBe('knight');
  });

  it('a queue of three moves together; four pieces block each other', () => {
    let three = start([...KINGS(), makePiece('knight', 'white', 'd4'), makePiece('bishop', 'black', 'd5'), makePiece('rook', 'white', 'e5')]);
    three = round(three);
    expect(at(three, 'd5')?.type).toBe('knight');
    expect(at(three, 'e5')?.type).toBe('bishop');
    expect(at(three, 'e4')?.type).toBe('rook');
    expect(at(three, 'd4')).toBeUndefined();

    let four = start([...KINGS(), makePiece('knight', 'white', 'd4'), makePiece('bishop', 'black', 'd5'), makePiece('rook', 'white', 'e5'), makePiece('pawn', 'black', 'e4')]);
    four = round(four);
    expect(at(four, 'd4')?.type).toBe('knight');
    expect(at(four, 'e4')?.type).toBe('pawn');
  });

  it('never captures, and a King turns only to a safe square', () => {
    // Black King on e5 would turn to e4, which the white rook on a4 attacks.
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'e5'), makePiece('rook', 'white', 'a4'), makePiece('pawn', 'black', 'h7')]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    expect(at(state, 'e5')?.type).toBe('king');
    expect(at(state, 'a4')?.type).toBe('rook');
    expect(chessEngine.isInCheck(state, 'black')).toBe(false);
  });

  it('shares the centre: one per match with Swamp, Tide, Crop Circles, the Factory and Gerald\'s statue', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    for (const other of [MODIFIER_IDS.thisIsMySwamp, MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.cropCircles, MODIFIER_IDS.factoryMustGrow, MODIFIER_IDS.monumentToGerald]) {
      expect(getValidOptions([], [other], built).map(c => c.id)).not.toContain(ID);
      expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(other);
    }
  });
});
