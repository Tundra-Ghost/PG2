import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { isInCheck } from '../engine/moveGenerator';
import type { GameState, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { oppositeSquare } from './definitions/vent-tiles';
import { makeEmptyState, makePiece, move } from './testHelpers';

const CHANCELLOR = MODIFIER_IDS.chancellor;
const TWINS = MODIFIER_IDS.twinTelepathy;
const VENTS = MODIFIER_IDS.ventTiles;

describe('MOD-E004 Equivalent Exchange (The Chancellor)', () => {
  it('turns one owner rook into a chancellor and drops castling on that side', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: CHANCELLOR, sourceColor: 'white' },
    ]);
    const chancellors = Array.from(state.pieces.values()).filter(p => p.type === 'chancellor');
    expect(chancellors).toHaveLength(1);
    expect(chancellors[0].color).toBe('white');
    const rights = state.flags.castlingRights.white;
    expect(chancellors[0].square === 'a1' ? rights.queenSide : rights.kingSide).toBe(false);
    expect(state.flags.castlingRights.black).toEqual({ kingSide: true, queenSide: true });
  });

  it('moves like a rook or a knight and gives check both ways', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('chancellor', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).toEqual(expect.arrayContaining(['d8', 'h4', 'a4', 'd1', 'e6', 'f5', 'b3', 'c2']));
    expect(moves).not.toContain('e5');

    const knightCheck = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('chancellor', 'white', 'd4'),
      makePiece('king', 'black', 'e6'),
    ]);
    expect(isInCheck(knightCheck, 'black')).toBe(true);
  });

  it('writes C in move notation', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('chancellor', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    const next = chessEngine.applyMove(state, move('d4', 'f5', 'white'));
    expect(next.moveHistory[0].notation).toBe('Cf5');
  });
});

describe('MOD-E005 Twin Telepathy', () => {
  function twins(extra: Parameters<typeof makeEmptyState>[0] = []): GameState {
    return chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('bishop', 'white', 'c1'),
        makePiece('bishop', 'white', 'f1'),
        makePiece('king', 'black', 'e8'),
        makePiece('pawn', 'black', 'a7'),
        ...extra,
      ]),
      [{ id: TWINS, sourceColor: null }],
    );
  }

  it('slides the twin the same direction and distance', () => {
    const next = chessEngine.applyMove(twins(), move('c1', 'e3', 'white'));
    expect(next.pieces.get('e3')?.type).toBe('bishop');
    expect(next.pieces.get('h3')?.type).toBe('bishop');
    expect(next.pieces.has('f1')).toBe(false);
    expect(next.eventHistory[next.eventHistory.length - 1]?.message).toBe('The white twin bishop mirrors f1 to h3.');
  });

  it('stops before blockers and never captures', () => {
    const next = chessEngine.applyMove(
      twins([makePiece('pawn', 'black', 'h3')]),
      move('c1', 'e3', 'white'),
    );
    expect(next.pieces.get('g2')?.type).toBe('bishop');
    expect(next.pieces.get('h3')).toMatchObject({ type: 'pawn', color: 'black' });
  });

  it('stays put when the slide would expose its own king', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('bishop', 'white', 'c1'),
        makePiece('bishop', 'white', 'e2'),
        makePiece('rook', 'black', 'e8'),
        makePiece('king', 'black', 'h8'),
      ]),
      [{ id: TWINS, sourceColor: null }],
    );
    const next = chessEngine.applyMove(state, move('c1', 'b2', 'white'));
    expect(next.pieces.get('e2')?.type).toBe('bishop');
    expect(isInCheck(next, 'white')).toBe(false);
  });
});

describe('MOD-A003 Vent Tiles', () => {
  function withVent(vent: Square, pieces: Parameters<typeof makeEmptyState>[0]): GameState {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      ...pieces,
    ]);
    state.activeModifiers = [{ id: VENTS, name: 'Vent Tiles', activeFor: 'both', sourceColor: null }];
    state.tiles.set(vent, { square: vent, effects: [], isVent: true });
    return state;
  }

  it('places 3 hidden vents on empty middle ranks, none opposite another', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: VENTS, sourceColor: null },
    ]);
    const vents = Array.from(state.tiles.values()).filter(t => t.isVent).map(t => t.square);
    expect(vents).toHaveLength(3);
    for (const sq of vents) {
      expect(['3', '4', '5', '6']).toContain(sq[1]);
      expect(vents).not.toContain(oppositeSquare(sq));
    }
  });

  it('maps squares through the board centre', () => {
    expect(oppositeSquare('c3')).toBe('f6');
    expect(oppositeSquare('a1')).toBe('h8');
  });

  it('ejects the first piece to the opposite square, capturing either colour, then becomes a shaft', () => {
    let state = withVent('c3', [
      makePiece('knight', 'white', 'b1'),
      makePiece('pawn', 'white', 'f6'),
      makePiece('rook', 'black', 'c8'),
    ]);
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white'));
    expect(state.pieces.get('f6')).toMatchObject({ type: 'knight', color: 'white' });
    expect(state.pieces.has('c3')).toBe(false);
    expect(state.tiles.get('c3')).toMatchObject({ isVent: false, isVoid: true });

    // The shaft blocks sliding through and landing.
    expect(chessEngine.getLegalMoves(state, 'c8')).toEqual(expect.arrayContaining(['c4']));
    expect(chessEngine.getLegalMoves(state, 'c8')).not.toContain('c3');
    expect(chessEngine.getLegalMoves(state, 'c8')).not.toContain('c2');
  });

  it('jams and stays hidden when a king sits on the exit', () => {
    let state = withVent('c3', [makePiece('knight', 'white', 'b1')]);
    state.pieces.delete('h8');
    state.pieces.set('f6', makePiece('king', 'black', 'f6'));
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white'));
    expect(state.pieces.get('c3')?.type).toBe('knight');
    expect(state.tiles.get('c3')?.isVent).toBe(true);
  });

  it('jams when the jump would expose the mover king', () => {
    // White king e1, rook on e3 shields from black rook e8 only after landing.
    let state = withVent('e4', [makePiece('rook', 'white', 'a4'), makePiece('rook', 'black', 'e8')]);
    state.pieces.delete('a1');
    state.pieces.set('e1', makePiece('king', 'white', 'e1'));
    state = chessEngine.applyMove(state, move('a4', 'e4', 'white'));
    expect(state.pieces.get('e4')?.type).toBe('rook');
    expect(isInCheck(state, 'white')).toBe(false);
  });
});
