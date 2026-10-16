import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { isHistoryBlackout } from './definitions/fifty-first-moves';
import { getNoFlySquares } from './definitions/no-fly-zone';
import { makeEmptyState, makePiece, move } from './testHelpers';

function withCard(pieces: Piece[], id: string, owner: 'white' | 'black' = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id, sourceColor: owner }],
  );
}

describe('MOD-E003 Yeah, There Are Three Of Them', () => {
  it('replaces the queen with two royal guards', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.threeKings, sourceColor: 'white' },
    ]);
    const white = Array.from(state.pieces.values()).filter(p => p.color === 'white');
    expect(white.some(p => p.type === 'queen')).toBe(false);
    expect(state.pieces.get('d1')?.type).toBe('royal_guard');
    expect(state.pieces.get('e3')?.type).toBe('royal_guard');
    expect(state.pieces.get('d8')?.type).toBe('queen');
  });

  it('guards step like kings and can be captured without ending the game', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('royal_guard', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'black', 'd8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'd4').sort()).toEqual(['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'].sort());
    state = chessEngine.applyMove(state, move('d4', 'd5', 'white'));
    state = chessEngine.applyMove(state, move('d8', 'd5', 'black'));
    expect(state.status).toBe('active');
    expect(state.moveHistory[0].notation).toBe('Gd5');
  });
});

describe('MOD-B005 50 First Moves', () => {
  it('blacks out moves 6 to 8, then every 6 moves', () => {
    const state = withCard([], MODIFIER_IDS.fiftyFirstMoves);
    const at = (n: number) => ({ ...state, flags: { ...state.flags, fullMoveNumber: n } });
    expect([5, 6, 7, 8, 9, 12, 15].map(n => isHistoryBlackout(at(n), 'white'))).toEqual([false, true, true, true, false, true, false]);
    expect(isHistoryBlackout(at(6), 'black')).toBe(false);
  });

  it('forbids en passant during a blackout', () => {
    let state = withCard([makePiece('pawn', 'white', 'e5'), makePiece('pawn', 'black', 'd7')], MODIFIER_IDS.fiftyFirstMoves);
    state.turn = 'black';
    state.flags.fullMoveNumber = 6;
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    expect(chessEngine.validateMove(state, move('e5', 'd6', 'white', { isEnPassant: true })).valid).toBe(false);
  });

  it('announces the blackout', () => {
    let state = withCard([makePiece('rook', 'white', 'a1'), makePiece('rook', 'black', 'h8')], MODIFIER_IDS.fiftyFirstMoves);
    state.flags.fullMoveNumber = 5;
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'h7', 'black'));
    expect(state.eventHistory[state.eventHistory.length - 1]?.title).toBe('50 FIRST MOVES');
  });
});

describe('MOD-C001 I Hereby Declare', () => {
  const NFZ = MODIFIER_IDS.noFlyZone;
  const setup = () =>
    withCard([makePiece('rook', 'black', 'a5'), makePiece('rook', 'black', 'h3'), makePiece('pawn', 'white', 'a2')], NFZ);

  it('closes the king file for 3 enemy turns', () => {
    let state = setup();
    expect(getAbilityOptions(state, 'e1')[0].targets).toHaveLength(14);
    state = chessEngine.applyMove(state, move('e1', 'e4', 'white', { ability: NFZ }));
    expect(state.pieces.get('e1')?.type).toBe('king');
    expect(getNoFlySquares(state).get('e5')).toBe('white');
    expect(chessEngine.validateMove(state, move('a5', 'h5', 'black')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('a5', 'e5', 'black')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('a5', 'd5', 'black')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('h3', 'f3', 'black')).valid).toBe(true);
    for (let i = 0; i < 3; i++) {
      state = chessEngine.applyMove(state, move(i % 2 ? 'a4' : 'a5', i % 2 ? 'a5' : 'a4', 'black'));
      state = chessEngine.applyMove(state, move(i % 2 ? 'a3' : 'a2', i % 2 ? 'a4' : 'a3', 'white'));
    }
    expect(getNoFlySquares(state).size).toBe(0);
  });

  it('a rank target closes the king rank', () => {
    const state = chessEngine.applyMove(setup(), move('e1', 'b1', 'white', { ability: NFZ }));
    expect(getNoFlySquares(state).get('h1')).toBe('white');
    expect(getNoFlySquares(state).has('e5')).toBe(false);
  });
});
