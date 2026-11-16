import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getStatueSquare } from '../engine/statue';
import { positionKey } from '../engine/gameLoop';
import { slideAll } from './definitions/gravitational-anomaly';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const MONUMENT = MODIFIER_IDS.monumentToGerald;

function withStatue(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: MONUMENT, sourceColor: 'white' }, ...extra]);
}

const kings = () => [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'a8')];

describe('MOD-A016 Monument To Gerald', () => {
  it('stands on e4 from the start of a real match', () => {
    let state = chessEngine.getInitialState();
    state = chessEngine.activateDraftModifiers(state, [{ id: MONUMENT, sourceColor: 'white' }]);
    expect(getStatueSquare(state)).toBe('e4');
  });

  it('cannot be landed on or passed through, by either side', () => {
    const state = withStatue([...kings(), makePiece('rook', 'white', 'e1'), makePiece('bishop', 'black', 'b7')]);
    const rook = chessEngine.getLegalMoves(state, 'e1');
    expect(rook).toContain('e3');
    expect(rook).not.toContain('e4');
    expect(rook).not.toContain('e5');
    expect(chessEngine.validateMove(state, move('e1', 'e5', 'white')).valid).toBe(false);
  });

  it('blocks a line of check', () => {
    const state = withStatue([makePiece('king', 'white', 'e1'), makePiece('rook', 'black', 'e8'), makePiece('king', 'black', 'a8')]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
  });

  it('is pushed one square by a neighbouring piece, which stays put', () => {
    let state = withStatue([...kings(), makePiece('rook', 'white', 'e3')]);
    expect(chessEngine.getLegalMoves(state, 'e3')).toContain('e4');
    state = chessEngine.applyMove(state, move('e3', 'e4', 'white'));
    expect(getStatueSquare(state)).toBe('e5');
    expect(state.pieces.get('e3')).toMatchObject({ type: 'rook', color: 'white' });
    expect(state.pieces.has('e4')).toBe(false);
    expect(state.turn).toBe('black');
    expect(state.moveHistory[0].notation).toBe('Re3 pushes e4-e5');
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: MONUMENT });
    // The old square is open again.
    expect(chessEngine.getLegalMoves(state, 'e3')).toContain('e4');
  });

  it('only pushes along the piece\'s own lines; knights cannot push', () => {
    const state = withStatue([
      ...kings(),
      makePiece('bishop', 'white', 'e3'),
      makePiece('knight', 'white', 'c3'),
      makePiece('pawn', 'white', 'd3'),
      makePiece('pawn', 'white', 'e5'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'e3')).not.toContain('e4');
    expect(chessEngine.getLegalMoves(state, 'c3')).not.toContain('e4');
    // A pawn pushes only straight ahead: d3 is diagonal to e4.
    expect(chessEngine.getLegalMoves(state, 'd3')).not.toContain('e4');
  });

  it('only moves onto an empty square', () => {
    const state = withStatue([...kings(), makePiece('queen', 'white', 'd3'), makePiece('pawn', 'black', 'f5')]);
    // d3 to e4 pushes toward f5, which is taken.
    expect(chessEngine.getLegalMoves(state, 'd3')).not.toContain('e4');
    const lava = withStatue([...kings(), makePiece('queen', 'white', 'e3')]);
    lava.tiles.set('e5', { square: 'e5', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    expect(chessEngine.getLegalMoves(lava, 'e3')).not.toContain('e4');
  });

  it('a push that opens a line onto your own King is refused', () => {
    // The statue on e4 shields the King on e1 from the rook on e8. Pushing it to f4 opens the file.
    const state = withStatue([
      makePiece('king', 'white', 'e1'),
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.validateMove(state, move('d4', 'e4', 'white')).valid).toBe(false);
  });

  it('a piece Gerald is holding cannot push the statue', () => {
    const state = withStatue([...kings(), makePiece('rook', 'white', 'e3')], [{ id: MODIFIER_IDS.gerald, sourceColor: 'white' }]);
    const rook = state.pieces.get('e3')!;
    state.pieces.set('e3', { ...rook, cooldowns: { [MODIFIER_IDS.gerald]: 2 } });
    expect(chessEngine.validateMove(state, move('e3', 'e4', 'white')).valid).toBe(false);
  });

  it('counts the statue square in repetition', () => {
    let state = withStatue([...kings(), makePiece('rook', 'white', 'e3')]);
    const before = positionKey(state);
    state = chessEngine.applyMove(state, move('e3', 'e4', 'white'));
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    state = chessEngine.applyMove(state, move('b8', 'a8', 'black'));
    expect(positionKey(state)).not.toBe(before);
  });

  it('cannot be castled through', () => {
    const state = withStatue([makePiece('king', 'white', 'e1'), makePiece('rook', 'white', 'h1'), makePiece('king', 'black', 'a8')]);
    const tile = state.tiles.get('e4')!;
    state.tiles.set('e4', { ...tile, statue: undefined, isVoid: undefined });
    state.tiles.set('f1', { square: 'f1', effects: [], statue: true, isVoid: true });
    state.flags.castlingRights.white = { kingSide: true, queenSide: false };
    expect(chessEngine.getLegalMoves(state, 'e1')).not.toContain('g1');
  });

  it('stops a Gravity slide instead of swallowing pieces', () => {
    const state = withStatue([...kings(), makePiece('rook', 'white', 'e3')]);
    const { next, lost } = slideAll(state, 'north');
    expect(lost).toEqual([]);
    expect(next.pieces.get('e3')).toMatchObject({ type: 'rook' });
    expect(getStatueSquare(next)).toBe('e4');
  });
});
