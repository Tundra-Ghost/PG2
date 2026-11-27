import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getRoombaSquare, inwardOf, nextOnRing, ROOMBA_RING } from './definitions/the-roomba';
import { getRoomba } from './flow';
import { getCloakedPiece } from './definitions/invisibility-cloak';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.theRoomba;

/** Starts with the Roomba placed on `at`. */
function start(pieces: Piece[], at: Square, extra: string[] = []): GameState {
  const picks = [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const }));
  const state = chessEngine.activateDraftModifiers(makeEmptyState(pieces), picks);
  return chessEngine.beginTurn({ ...state, modifierState: { ...state.modifierState, [ID]: { at } } });
}

/** One full round of King shuffles (c3-d3, f6-e6), clear of the ring. */
function round(state: GameState): GameState {
  const steps: Record<string, Square> = { c3: 'd3', d3: 'c3', f6: 'e6', e6: 'f6' };
  for (let i = 0; i < 2; i++) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const at = (state: GameState, sq: Square) => state.pieces.get(sq);
const KINGS = () => [makePiece('king', 'white', 'c3'), makePiece('king', 'black', 'f6'), makePiece('pawn', 'white', 'd2')];

describe('MOD-A015 The Roomba', () => {
  it('the ring runs clockwise as White sees it; corners push diagonally inward', () => {
    expect(ROOMBA_RING).toHaveLength(28);
    expect(nextOnRing('a4')).toBe('a5');
    expect(nextOnRing('a8')).toBe('b8');
    expect(nextOnRing('h8')).toBe('h7');
    expect(nextOnRing('h1')).toBe('g1');
    expect(nextOnRing('b1')).toBe('a1');
    expect(inwardOf('a5')).toBe('b5');
    expect(inwardOf('e8')).toBe('e7');
    expect(inwardOf('h1')).toBe('g2');
  });

  it('starts on a4 or h5, picked with the seed', () => {
    const state = chessEngine.activateDraftModifiers(makeEmptyState(KINGS()), [{ id: ID, sourceColor: 'white' }]);
    expect(['a4', 'h5']).toContain(getRoombaSquare(state));
  });

  it('moves one square per round, after Black moves', () => {
    let state = start(KINGS(), 'a4');
    state = chessEngine.applyMove(state, move('c3', 'd3', 'white'));
    expect(getRoombaSquare(state)).toBe('a4');
    state = chessEngine.applyMove(state, move('f6', 'e6', 'black'));
    expect(getRoombaSquare(state)).toBe('a5');
    expect(getRoomba(state)).toEqual({ square: 'a5', heading: 'north' });
  });

  it('pushes a piece one square inward and moves on; waits when it cannot', () => {
    let state = start([...KINGS(), makePiece('rook', 'black', 'a5')], 'a4');
    state = round(state);
    expect(at(state, 'b5')?.type).toBe('rook');
    expect(getRoombaSquare(state)).toBe('a5');

    let blocked = start([...KINGS(), makePiece('rook', 'black', 'a5'), makePiece('knight', 'white', 'b5')], 'a4');
    blocked = round(blocked);
    expect(at(blocked, 'a5')?.type).toBe('rook'); // never captures
    expect(at(blocked, 'b5')?.type).toBe('knight');
    expect(getRoombaSquare(blocked)).toBe('a4');
  });

  it('never pushes a King into check', () => {
    // The black King on a5 would go to b5, which the white rook on b1 attacks.
    let state = start([makePiece('king', 'white', 'c3'), makePiece('king', 'black', 'a5'), makePiece('rook', 'white', 'b1'), makePiece('pawn', 'black', 'h7')], 'a4');
    state = chessEngine.applyMove(state, move('c3', 'd3', 'white'));
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    expect(at(state, 'a5')?.type).toBe('king');
    expect(getRoombaSquare(state)).toBe('a4');
  });

  it('parks when the storm has taken the next square (The Storm Closes In interaction)', () => {
    let state = start(KINGS(), 'a4', [MODIFIER_IDS.stormClosesIn]);
    state = { ...state, tiles: new Map(state.tiles).set('a5', { square: 'a5', effects: [], storm: 'active', isVoid: true }) };
    state = round(state);
    expect(getRoombaSquare(state)).toBe('a4');
  });

  it('a hidden piece it bumps is revealed', () => {
    let state = start([makePiece('king', 'white', 'c3'), makePiece('king', 'black', 'f6'), makePiece('knight', 'white', 'a5'), makePiece('pawn', 'black', 'h7')], 'a4', [MODIFIER_IDS.invisibilityCloak]);
    expect(getCloakedPiece(state, 'white')).toBe(at(state, 'a5')!.id);
    state = round(state);
    expect(at(state, 'b5')?.type).toBe('knight');
    expect(getCloakedPiece(state, 'white')).toBeNull();
  });
});
