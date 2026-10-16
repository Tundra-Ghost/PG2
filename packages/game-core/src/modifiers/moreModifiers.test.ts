import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { REGINALD_GENERAL_REVIEWS } from './definitions/reginald-beak';
import { makeEmptyState, makePiece, move } from './testHelpers';

const SWAMP = MODIFIER_IDS.thisIsMySwamp;
const REGINALD = MODIFIER_IDS.reginaldBeak;
const COUNCIL = MODIFIER_IDS.smallCouncil;

function piecesOf(pieces: Iterable<Piece>, color: Piece['color'], type: Piece['type']): string[] {
  return Array.from(pieces)
    .filter(p => p.color === color && p.type === type)
    .map(p => p.square)
    .sort();
}

describe('MOD-A006 This Is My Swamp', () => {
  function swampState(pieces: Piece[]) {
    return chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'h8'), ...pieces]),
      [{ id: SWAMP, sourceColor: 'white' }],
    );
  }

  it('marks the four central squares as swamp tiles', () => {
    const state = swampState([]);
    const swampTiles = Array.from(state.tiles.values()).filter(t => t.isSwamp).map(t => t.square).sort();
    expect(swampTiles).toEqual(['d4', 'd5', 'e4', 'e5']);
  });

  it('limits a piece in the swamp to 1 square, captures included', () => {
    const state = swampState([
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'd7'),
      makePiece('pawn', 'black', 'c5'),
    ]);

    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white'))).toEqual({
      valid: false,
      reason: 'In the Swamp a piece moves only 1 square.',
    });
    expect(chessEngine.validateMove(state, move('d4', 'd7', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'c5', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('d4', 'd3', 'white')).valid).toBe(true);
  });

  it('lets pieces outside the swamp slide through it', () => {
    const state = swampState([makePiece('rook', 'white', 'd1')]);
    expect(chessEngine.validateMove(state, move('d1', 'd8', 'white')).valid).toBe(true);
  });

  it('traps a knight that lands in the swamp for 2 of its turns', () => {
    let state = swampState([makePiece('knight', 'white', 'c2'), makePiece('rook', 'white', 'a1')]);

    state = chessEngine.applyMove(state, move('c2', 'd4', 'white'));
    expect(state.eventHistory[state.eventHistory.length - 1]?.modifierId).toBe(SWAMP);

    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'f5', 'white')).valid).toBe(false);

    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('g8', 'h8', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'f5', 'white')).valid).toBe(false);

    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'f5', 'white')).valid).toBe(true);
  });
});

describe('MOD-B008 7/10 Too Many Pieces', () => {
  it('reviews every move the owner makes and none of the opponent moves', () => {
    let state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: REGINALD, sourceColor: 'white' },
    ]);

    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    expect(state.eventHistory).toHaveLength(1);
    expect(state.eventHistory[0].title).toBe('Reginald Beak');
    expect(state.eventHistory[0].message).toMatch(/^\d+\/10\./);

    state = chessEngine.applyMove(state, move('e7', 'e5', 'black'));
    expect(state.eventHistory).toHaveLength(1);
  });

  it('has no effect on the position', () => {
    const plain = chessEngine.applyMove(chessEngine.getInitialState(), move('g1', 'f3', 'white'));
    const reviewed = chessEngine.applyMove(
      chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: REGINALD, sourceColor: 'white' }]),
      move('g1', 'f3', 'white'),
    );
    expect(Array.from(reviewed.pieces.keys()).sort()).toEqual(Array.from(plain.pieces.keys()).sort());
    expect(reviewed.turn).toBe('black');
  });

  it('ships at least 20 general review lines in the X/10 format', () => {
    expect(REGINALD_GENERAL_REVIEWS.length).toBeGreaterThanOrEqual(20);
    for (const line of REGINALD_GENERAL_REVIEWS) expect(line).toMatch(/^\d+\/10\. /);
  });
});

describe('MOD-E002 The Small Council', () => {
  it('replaces the owner knights and bishops with 12 pawns one rank forward', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: COUNCIL, sourceColor: 'black' },
    ]);
    const pieces = state.pieces.values();
    const all = Array.from(pieces);

    expect(piecesOf(all, 'black', 'knight')).toEqual([]);
    expect(piecesOf(all, 'black', 'bishop')).toEqual([]);
    expect(piecesOf(all, 'black', 'pawn')).toEqual(
      ['a6', 'b6', 'b7', 'c6', 'c7', 'd6', 'e6', 'f6', 'f7', 'g6', 'g7', 'h6'],
    );
    expect(piecesOf(all, 'black', 'rook')).toEqual(['a8', 'h8']);
    expect(piecesOf(all, 'black', 'queen')).toEqual(['d8']);
    expect(piecesOf(all, 'black', 'king')).toEqual(['e8']);
    // The opponent keeps the standard army.
    expect(piecesOf(all, 'white', 'pawn')).toHaveLength(8);
    expect(piecesOf(all, 'white', 'knight')).toEqual(['b1', 'g1']);
    expect(new Set(all.map(p => p.id)).size).toBe(all.length);
  });

  it('counts the new start position for repetition', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: COUNCIL, sourceColor: 'white' },
    ]);
    expect(Object.values(state.positionHistory)).toEqual([1]);
  });

  it('third-rank pawns step 1 square and the side still has legal moves', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: COUNCIL, sourceColor: 'white' },
    ]);
    expect(chessEngine.getLegalMoves(state, 'e3')).toEqual(['e4']);
    expect(chessEngine.getLegalMoves(state, 'c2')).toEqual([]);
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
  });
});

describe('owned modifiers drafted by both sides', () => {
  it('Reginald reviews each side once per move', () => {
    let state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: REGINALD, sourceColor: 'white' },
      { id: REGINALD, sourceColor: 'black' },
    ]);
    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    expect(state.eventHistory).toHaveLength(1);
    state = chessEngine.applyMove(state, move('e7', 'e5', 'black'));
    expect(state.eventHistory).toHaveLength(2);
  });

  it('Gerald cooldowns tick once per turn, not once per drafted copy', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('rook', 'white', 'a1'),
        makePiece('king', 'black', 'e8'),
        makePiece('rook', 'black', 'h8'),
      ]),
      [
        { id: MODIFIER_IDS.gerald, sourceColor: 'white' },
        { id: MODIFIER_IDS.gerald, sourceColor: 'black' },
      ],
    );
    state = chessEngine.beginTurn(state);
    expect(state.pieces.get('a1')?.cooldowns[MODIFIER_IDS.gerald]).toBe(2);
    state = chessEngine.applyMove(state, move('e1', 'd1', 'white'));
    // Gerald never targets kings, so the black king is free to move.
    state = chessEngine.applyMove(state, move('e8', 'd8', 'black'));
    expect(state.pieces.get('a1')?.cooldowns[MODIFIER_IDS.gerald]).toBe(1);
  });

  it('Small Council rebuilds both armies when both sides draft it', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: COUNCIL, sourceColor: 'white' },
      { id: COUNCIL, sourceColor: 'black' },
    ]);
    const all = Array.from(state.pieces.values());
    expect(piecesOf(all, 'white', 'pawn')).toHaveLength(12);
    expect(piecesOf(all, 'black', 'pawn')).toHaveLength(12);
  });
});

describe('Swamp with other board mutations', () => {
  it('keeps the Swamp when lava rotates', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'h1'),
        makePiece('rook', 'white', 'a1'),
        makePiece('king', 'black', 'h8'),
        makePiece('rook', 'black', 'a8'),
      ]),
      [
        { id: SWAMP, sourceColor: null },
        { id: MODIFIER_IDS.floorIsLava, sourceColor: null },
      ],
    );
    const lavaBefore = Array.from(state.tiles.values()).filter(t => t.effects.length > 0).map(t => t.square);
    // Lava rotates at the start of every third turn.
    state.turnNumber = 3;
    state = chessEngine.beginTurn(state);
    const lavaAfter = Array.from(state.tiles.values()).filter(t => t.effects.length > 0).map(t => t.square);
    expect(lavaAfter).not.toEqual(lavaBefore);
    const swampTiles = Array.from(state.tiles.values()).filter(t => t.isSwamp);
    expect(swampTiles).toHaveLength(4);
  });
});
