import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getFlowArrows } from './flow';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { getBestCaptureTarget } from './definitions/berserker';

const ID = MODIFIER_IDS.oneWayStreet;

function start(pieces: Piece[], extra: string[] = []): GameState {
  const picks = [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const }));
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), picks));
}

const ok = (state: GameState, from: string, to: string) =>
  chessEngine.validateMove(state, move(from as never, to as never, state.turn)).valid;

describe('MOD-A020 One Way Street', () => {
  it('the c-file runs north only and the f-file south only', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'white', 'c4'), makePiece('rook', 'white', 'f4')]);
    expect(ok(state, 'c4', 'c7')).toBe(true);
    expect(ok(state, 'c4', 'c2')).toBe(false);
    expect(ok(state, 'f4', 'f2')).toBe(true);
    expect(ok(state, 'f4', 'f7')).toBe(false);
  });

  it('crossing or leaving the file is allowed, and captures across it are not limited', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'white', 'c4'), makePiece('bishop', 'white', 'b2'), makePiece('pawn', 'black', 'g7')]);
    expect(ok(state, 'c4', 'h4')).toBe(true);
    expect(ok(state, 'b2', 'g7')).toBe(true); // a diagonal capture crossing both files
  });

  it('pawns follow the signs: a black pawn on the c-file cannot step south', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'c7'), makePiece('pawn', 'black', 'a7'), makePiece('pawn', 'white', 'h2')]);
    state = chessEngine.applyMove(state, move('h2', 'h3', 'white'));
    expect(ok(state, 'c7', 'c6')).toBe(false);
    expect(ok(state, 'a7', 'a6')).toBe(true);
  });

  it('Kings ignore the signs', () => {
    const state = start([makePiece('king', 'white', 'c4'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'white', 'a2')]);
    expect(ok(state, 'c4', 'c3')).toBe(true);
  });

  it('in check, any legal move is allowed', () => {
    // The white rook on c5 blocks the check from the rook on h2 by going south to c2, against the sign.
    const state = start([makePiece('king', 'white', 'a2'), makePiece('rook', 'black', 'h2'), makePiece('king', 'black', 'h8'), makePiece('rook', 'white', 'c5')]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(ok(state, 'c5', 'c2')).toBe(true);
  });

  it('draws arrows on both files', () => {
    const arrows = getFlowArrows(start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')]));
    expect(arrows.get('c1')).toEqual(['north']);
    expect(arrows.get('f8')).toEqual(['south']);
  });

  it('interaction with The Factory Must Grow: c4, c5, f4 and f5 show both arrows', () => {
    const arrows = getFlowArrows(start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')], [MODIFIER_IDS.factoryMustGrow]));
    expect(arrows.get('c4')).toEqual(['east', 'north']);
  });

  it('one per match with Bandersnatch Protocol, which mirrors c onto f', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    expect(getValidOptions([], [MODIFIER_IDS.bandersnatch], built).map(c => c.id)).not.toContain(ID);
    expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(MODIFIER_IDS.bandersnatch);
  });

  it('a Berserker chain capture follows the signs (interaction)', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'white', 'c5'), makePiece('queen', 'black', 'c2'), makePiece('pawn', 'black', 'a5')]);
    expect(getBestCaptureTarget(state, 'c5')).toBe('a5');
  });
});
