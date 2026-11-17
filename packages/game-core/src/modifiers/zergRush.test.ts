import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { buildMove, getValidPromotionTypes } from '../engine/gameLoop';
import { getLegalMovesForPiece } from '../engine/moveGenerator';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ZERG = MODIFIER_IDS.zergRush;

function withZerg(pieces: Piece[], owner: 'white' | 'black' = 'white', kings = true): GameState {
  const base = kings ? [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'h8')] : [];
  return chessEngine.activateDraftModifiers(makeEmptyState([...base, ...pieces]), [{ id: ZERG, sourceColor: owner }]);
}

function movesFrom(state: GameState, sq: Square): Square[] {
  return getLegalMovesForPiece(state, state.pieces.get(sq)!).sort();
}

describe('MOD-E018 Zerg Rush', () => {
  it('lets the owner\'s pawns move two squares from any rank', () => {
    let state = withZerg([makePiece('pawn', 'white', 'd4')]);
    expect(movesFrom(state, 'd4')).toEqual(['d5', 'd6']);
    state = chessEngine.applyMove(state, move('d4', 'd6', 'white'));
    expect(state.pieces.get('d6')).toMatchObject({ type: 'pawn', color: 'white' });
  });

  it('works for black, and not for the other side', () => {
    const state = withZerg([makePiece('pawn', 'black', 'c5'), makePiece('pawn', 'white', 'f3')], 'black');
    expect(movesFrom(state, 'c5')).toEqual(['c3', 'c4']);
    expect(movesFrom(state, 'f3')).toEqual(['f4']);
  });

  it('needs both squares empty', () => {
    const near = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'd5')]);
    expect(movesFrom(near, 'd4')).toEqual([]);
    const far = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'd6')]);
    expect(movesFrom(far, 'd4')).toEqual(['d5']);
  });

  it('still captures normally, one square diagonally', () => {
    const state = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'e5'), makePiece('knight', 'black', 'f6')]);
    expect(movesFrom(state, 'd4')).toEqual(['d5', 'd6', 'e5']);
  });

  it('may reach the last rank with two squares and promote', () => {
    const state = withZerg([makePiece('pawn', 'white', 'b6')]);
    expect(movesFrom(state, 'b6')).toEqual(['b7', 'b8']);
    expect(chessEngine.isPromotionMove(state, 'b6', 'b8')).toBe(true);
    expect(getValidPromotionTypes(state, 'b6', 'b8')).toContain('queen');
  });

  it('a two-square move that promotes leaves no en passant', () => {
    let state = withZerg([makePiece('pawn', 'white', 'b6'), makePiece('pawn', 'black', 'a8')]);
    state = chessEngine.applyMove(state, move('b6', 'b8', 'white', { promotion: 'queen' }));
    expect(state.pieces.get('b8')).toMatchObject({ type: 'queen', color: 'white' });
    expect(state.flags.enPassantSquare).toBeNull();
  });

  it('I\'ve Been Waiting For This cannot bank a two-square move from another rank', () => {
    let state = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('pawn', 'black', 'e6')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.bankedEnPassant, sourceColor: 'black' }]);
    state = chessEngine.applyMove(state, move('d4', 'd6', 'white'));
    const banked = getAbilityOptions(state, 'e6').find(o => o.modifierId === MODIFIER_IDS.bankedEnPassant);
    expect(banked?.targets ?? []).toEqual([]);
  });

  it('I\'ve Been Waiting For This still banks a two-square move from the starting rank', () => {
    let state = withZerg([makePiece('pawn', 'white', 'd2'), makePiece('pawn', 'black', 'e4')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.bankedEnPassant, sourceColor: 'black' }]);
    state = chessEngine.applyMove(state, move('d2', 'd4', 'white'));
    const banked = getAbilityOptions(state, 'e4').find(o => o.modifierId === MODIFIER_IDS.bankedEnPassant);
    expect(banked?.targets).toEqual(['d3']);
  });

  it('a two-square move from another rank cannot be taken en passant', () => {
    let state = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('pawn', 'black', 'e6')]);
    state = chessEngine.applyMove(state, move('d4', 'd6', 'white'));
    expect(state.flags.enPassantSquare).toBeNull();
    expect(movesFrom(state, 'e6')).not.toContain('d5');
    expect(buildMove(state, 'e6', 'd5').isEnPassant).toBeFalsy();
  });

  it('a black two-square move from another rank cannot be taken en passant', () => {
    let state = withZerg([makePiece('pawn', 'black', 'c5'), makePiece('pawn', 'white', 'd3')], 'black');
    state = { ...state, turn: 'black' };
    state = chessEngine.applyMove(state, move('c5', 'c3', 'black'));
    expect(state.flags.enPassantSquare).toBeNull();
    expect(movesFrom(state, 'd3')).not.toContain('c4');
  });

  it('a normal two-square move from the starting rank can still be taken en passant', () => {
    let state = withZerg([makePiece('pawn', 'white', 'd2'), makePiece('pawn', 'black', 'e4')]);
    state = chessEngine.applyMove(state, move('d2', 'd4', 'white'));
    expect(state.flags.enPassantSquare).toBe('d3');
    const ep = buildMove(state, 'e4', 'd3');
    expect(ep.isEnPassant).toBe(true);
    state = chessEngine.applyMove(state, ep);
    expect(state.pieces.has('d4')).toBe(false);
    expect(state.pieces.get('d3')).toMatchObject({ type: 'pawn', color: 'black' });
  });

  it('may not leave the King in check', () => {
    // The d4 pawn shields the king on c3 from the bishop on f6.
    const state = withZerg([
      makePiece('king', 'white', 'c3'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('bishop', 'black', 'f6'),
    ], 'white', false);
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white'))).toEqual({ valid: false, reason: 'leaves king in check' });
  });

  it('may block a check with two squares', () => {
    const state = withZerg([
      makePiece('king', 'white', 'h5'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd3'),
      makePiece('rook', 'black', 'a5'),
    ], 'white', false);
    expect(chessEngine.validateMove(state, move('d3', 'd5', 'white')).valid).toBe(true);
  });

  it('cannot jump over or onto a void square', () => {
    const state = withZerg([makePiece('pawn', 'white', 'd4'), makePiece('pawn', 'white', 'e4')]);
    state.tiles.set('d5', { square: 'd5', effects: [], isVoid: true });
    state.tiles.set('e6', { square: 'e6', effects: [], isVoid: true });
    expect(movesFrom(state, 'd4')).toEqual([]);
    expect(movesFrom(state, 'e4')).toEqual(['e5']);
  });

  it('an infected pawn loses its two-square move', () => {
    const state = withZerg([makePiece('pawn', 'white', 'd4', 'rusher')]);
    state.activeModifiers.push({ id: MODIFIER_IDS.cordycepticSpread, name: 'The Cordyceptic Spread', activeFor: 'both', sourceColor: null });
    state.tiles.set('d4', { square: 'd4', effects: [{ type: 'infected', turnsRemaining: -1 }] });
    state.modifierState[MODIFIER_IDS.cordycepticSpread] = { rot: { rusher: 1 } };
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'd5', 'white')).valid).toBe(true);
  });

  it('lets Small Council third-rank pawns double step', () => {
    let state = makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8')]);
    state = chessEngine.activateDraftModifiers(state, [
      { id: MODIFIER_IDS.smallCouncil, sourceColor: 'white' },
      { id: ZERG, sourceColor: 'white' },
    ]);
    expect(movesFrom(state, 'd3')).toEqual(['d4', 'd5']);
  });
});
