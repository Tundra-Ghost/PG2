import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { DASH_COOLDOWN } from './definitions/gotta-go-fast';
import { makeEmptyState, makePiece, move } from './testHelpers';

const DASH = MODIFIER_IDS.gottaGoFast;

function withDash(pieces: Piece[], owner: 'white' | 'black' = 'white', kings = true): GameState {
  const base = kings ? [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'h8')] : [];
  return chessEngine.activateDraftModifiers(makeEmptyState([...base, ...pieces]), [{ id: DASH, sourceColor: owner }]);
}

function dashTargets(state: GameState, square: Square): Square[] {
  return getAbilityOptions(state, square).find(option => option.modifierId === DASH)?.targets ?? [];
}

describe('MOD-C020 Gotta Go Fast', () => {
  it('dashes a pawn two squares forward from any rank', () => {
    let state = withDash([makePiece('pawn', 'white', 'e3'), makePiece('rook', 'black', 'a8')]);
    expect(dashTargets(state, 'e3')).toEqual(['e5']);

    state = chessEngine.applyMove(state, move('e3', 'e5', 'white', { ability: DASH }));
    expect(state.pieces.get('e5')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.pieces.has('e3')).toBe(false);
    expect(state.turn).toBe('black');
    expect(state.moveHistory[0].notation).toBe('Pe3-e5');
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: DASH, title: 'GOTTA GO FAST' });
  });

  it('works for black too, moving down the board', () => {
    const state = withDash([makePiece('pawn', 'black', 'c6')], 'black');
    state.turn = 'black';
    expect(dashTargets(state, 'c6')).toEqual(['c4']);
  });

  it('needs both squares empty and never captures', () => {
    const blockedNear = withDash([makePiece('pawn', 'white', 'e3'), makePiece('knight', 'black', 'e4')]);
    expect(dashTargets(blockedNear, 'e3')).toEqual([]);
    const blockedFar = withDash([makePiece('pawn', 'white', 'e3'), makePiece('knight', 'black', 'e5')]);
    expect(dashTargets(blockedFar, 'e3')).toEqual([]);
    expect(chessEngine.validateMove(blockedFar, move('e3', 'e5', 'white', { ability: DASH })).valid).toBe(false);
  });

  it('cannot reach the last rank, so a dash never promotes', () => {
    const state = withDash([makePiece('pawn', 'white', 'e6'), makePiece('pawn', 'white', 'b5')]);
    expect(dashTargets(state, 'e6')).toEqual([]);
    expect(dashTargets(state, 'b5')).toEqual(['b7']);
  });

  it('gives no en passant against a dash', () => {
    let state = withDash([makePiece('pawn', 'white', 'e3'), makePiece('pawn', 'black', 'd5')]);
    state = chessEngine.applyMove(state, move('e3', 'e5', 'white', { ability: DASH }));
    expect(state.flags.enPassantSquare).toBeNull();
    expect(chessEngine.validateMove(state, move('d5', 'e4', 'black', { isEnPassant: true })).valid).toBe(false);
  });

  it('waits 4 own turns after a dash', () => {
    let state = withDash([makePiece('pawn', 'white', 'e3'), makePiece('rook', 'black', 'a8')]);
    state = chessEngine.applyMove(state, move('e3', 'e5', 'white', { ability: DASH }));
    for (let turn = 1; turn <= DASH_COOLDOWN; turn++) {
      state = chessEngine.applyMove(state, move(`a${9 - turn}` as Square, `a${8 - turn}` as Square, 'black'));
      expect(getAbilityOptions(state, 'e5')[0].cooldownLeft).toBeGreaterThan(0);
      expect(chessEngine.validateMove(state, move('e5', 'e7', 'white', { ability: DASH })).valid).toBe(false);
      state = chessEngine.applyMove(state, move(turn % 2 ? 'h1' : 'g1', turn % 2 ? 'g1' : 'h1', 'white'));
    }
    state = chessEngine.applyMove(state, move('a4', 'a3', 'black'));
    expect(dashTargets(state, 'e5')).toEqual(['e7']);
  });

  it('is only offered to the owner', () => {
    const state = withDash([makePiece('pawn', 'black', 'c6')], 'white');
    state.turn = 'black';
    expect(getAbilityOptions(state, 'c6')).toEqual([]);
    expect(chessEngine.validateMove(state, move('c6', 'c4', 'black', { ability: DASH })).valid).toBe(false);
  });

  it('may not leave the King in check', () => {
    // The d2 pawn shields the king on c1 from the bishop on f4.
    const state = withDash([
      makePiece('king', 'white', 'c1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('bishop', 'black', 'f4'),
    ], 'white', false);
    expect(chessEngine.validateMove(state, move('d2', 'd4', 'white', { ability: DASH }))).toEqual({
      valid: false,
      reason: 'leaves king in check',
    });
    expect(dashTargets(state, 'd2')).toEqual([]);
  });

  it('may block a check', () => {
    const state = withDash([
      makePiece('king', 'white', 'h4'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('rook', 'black', 'a4'),
    ], 'white', false);
    expect(dashTargets(state, 'd2')).toEqual(['d4']);
  });

  it('cannot dash out of the Swamp, where pieces move one square', () => {
    let state = withDash([makePiece('pawn', 'white', 'd4')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white', { ability: DASH })).valid).toBe(false);
  });

  it('is not banked by I\'ve Been Waiting For This', () => {
    let state = withDash([makePiece('pawn', 'white', 'e3'), makePiece('pawn', 'black', 'd5')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.bankedEnPassant, sourceColor: 'black' }]);
    state = chessEngine.applyMove(state, move('e3', 'e5', 'white', { ability: DASH }));
    expect(getAbilityOptions(state, 'd5').find(o => o.modifierId === MODIFIER_IDS.bankedEnPassant)?.targets ?? []).toEqual([]);
  });
});
