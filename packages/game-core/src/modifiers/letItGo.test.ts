import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.letItGo;
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

function start(pieces: Piece[], extra: string[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const })));
}

describe('MOD-A012 Let It Go', () => {
  it('marks c3 to f6 as ice', () => {
    const state = start(KINGS());
    expect(state.tiles.get('c3')?.ice).toBe(true);
    expect(state.tiles.get('f6')?.ice).toBe(true);
    expect(state.tiles.get('b3')?.ice).toBeUndefined();
    expect(state.tiles.get('g6')?.ice).toBeUndefined();
  });

  it('a rook that moves onto ice slides to the edge of the ice', () => {
    let state = start([...KINGS(), makePiece('rook', 'white', 'd1')]);
    state = chessEngine.applyMove(state, move('d1', 'd3', 'white'));
    expect(state.pieces.get('d3')).toBeUndefined();
    expect(state.pieces.get('d6')).toMatchObject({ type: 'rook', color: 'white' });
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Ice' });
  });

  it('a bishop slides diagonally and stops on the square before a piece', () => {
    let state = start([...KINGS(), makePiece('bishop', 'white', 'b2'), makePiece('pawn', 'black', 'f6')]);
    state = chessEngine.applyMove(state, move('b2', 'c3', 'white'));
    expect(state.pieces.get('e5')).toMatchObject({ type: 'bishop' });
    expect(state.pieces.get('f6')).toMatchObject({ type: 'pawn', color: 'black' });
  });

  it('a capture stops where it captured', () => {
    let state = start([...KINGS(), makePiece('queen', 'white', 'd1'), makePiece('pawn', 'black', 'd4')]);
    state = chessEngine.applyMove(state, move('d1', 'd4', 'white'));
    expect(state.pieces.get('d4')).toMatchObject({ type: 'queen', color: 'white' });
    expect(state.pieces.get('d5')).toBeUndefined();
  });

  it('knights, pawns and Kings have good shoes', () => {
    let state = start([makePiece('king', 'white', 'b3'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1'), makePiece('pawn', 'black', 'e7')]);
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white'));
    expect(state.pieces.get('c3')).toMatchObject({ type: 'knight' });
    state = chessEngine.applyMove(state, move('e7', 'e5', 'black'));
    expect(state.pieces.get('e5')).toMatchObject({ type: 'pawn' });
    state = chessEngine.applyMove(state, move('b3', 'c4', 'white'));
    expect(state.pieces.get('c4')).toMatchObject({ type: 'king' });
  });

  it('a slide that would leave its own King in check stops on the last safe square', () => {
    // The rook lands on e4 between the King on e1 and the rook on e8. Sliding on to f4 would expose the King.
    let state = start([makePiece('king', 'white', 'e1'), makePiece('rook', 'black', 'e8'), makePiece('king', 'black', 'a8'), makePiece('rook', 'white', 'a4')]);
    state = chessEngine.applyMove(state, move('a4', 'e4', 'white'));
    expect(state.pieces.get('e4')).toMatchObject({ type: 'rook', color: 'white' });
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
  });

  it('the slide may give check', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'f8'), makePiece('rook', 'white', 'b4')]);
    state = chessEngine.applyMove(state, move('b4', 'c4', 'white'));
    expect(state.pieces.get('f4')).toMatchObject({ type: 'rook' });
    expect(chessEngine.isInCheck(state, 'black')).toBe(true);
  });

  it('a moved rook ends castling on its side', () => {
    let state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'white', 'a1')]);
    state.flags.castlingRights.white = { kingSide: false, queenSide: true };
    state = chessEngine.applyMove(state, move('a1', 'a3', 'white'));
    expect(state.flags.castlingRights.white.queenSide).toBe(false);
  });

  it('stops before Gerald\'s statue (interaction)', () => {
    let state = start([...KINGS(), makePiece('rook', 'white', 'e1')], [MODIFIER_IDS.monumentToGerald]);
    expect(state.tiles.get('e4')?.statue).toBe(true);
    state = chessEngine.applyMove(state, move('e1', 'e3', 'white'));
    expect(state.pieces.get('e3')).toMatchObject({ type: 'rook' });
  });

  it('one per match with the Swamp, the portals and the tide', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    for (const other of [MODIFIER_IDS.thisIsMySwamp, MODIFIER_IDS.thinkingWithPortals, MODIFIER_IDS.tideGoesIn]) {
      expect(getValidOptions([], [other], built).map(c => c.id)).not.toContain(ID);
      expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(other);
    }
  });
});
