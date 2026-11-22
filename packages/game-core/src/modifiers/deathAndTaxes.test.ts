import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { TAX_EVERY, getTaxedPawn } from './definitions/death-and-taxes';
import { getValidOptions } from '../draft/rules';
import { makeEmptyState, makePiece, move } from './testHelpers';

const TAX = MODIFIER_IDS.deathAndTaxes;

function withTax(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: TAX, sourceColor: 'white' }, ...extra]);
}

/** Kings shuffle until White has made `n` moves; the last one is White's. */
function playWhiteMoves(state: GameState, n: number): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  let white = 0;
  while (white < n) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
    if (state.turn === 'white') white++;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const PIECES = () => [
  makePiece('king', 'white', 'a1'),
  makePiece('rook', 'white', 'd1'),
  makePiece('pawn', 'white', 'c2'),
  makePiece('pawn', 'white', 'b2'),
  makePiece('pawn', 'white', 'e4'),
  makePiece('king', 'black', 'h8'),
  makePiece('pawn', 'black', 'g7'),
];

describe('MOD-B013 Death And Taxes', () => {
  it('warns at the start of the 10th move, then takes the rearmost pawn after it', () => {
    let state = withTax(PIECES());
    state = playWhiteMoves(state, TAX_EVERY - 1);
    // Black has moved; White's 10th move starts with the warning.
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('h8', 'g8', 'black'));
    expect(state.turn).toBe('white');
    const warning = state.eventHistory[state.eventHistory.length - 1];
    expect(warning).toMatchObject({ modifierId: TAX, title: 'TAX DAY', squares: ['b2'] });
    expect(state.pieces.get('b2')).toBeDefined();
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('a1', 'b1', 'white'));
    // b2 and c2 tie for rearmost; the a-file side goes first.
    expect(state.pieces.get('b2')).toBeUndefined();
    expect(state.pieces.get('c2')).toBeDefined();
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: TAX, title: 'TAXED' });
  });

  it('never takes a pawn that shields its King from check', () => {
    const state = withTax([
      makePiece('king', 'white', 'a4'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('pawn', 'white', 'f6'),
      makePiece('rook', 'black', 'h4'),
      makePiece('king', 'black', 'h8'),
    ]);
    // d4 is further back but pinned; f6 is taken instead.
    expect(getTaxedPawn(state, 'white')).toBe('f6');
  });

  it('ends once there are no pawns', () => {
    const state = withTax([makePiece('king', 'white', 'a1'), makePiece('rook', 'white', 'd1'), makePiece('king', 'black', 'h8')]);
    expect(getTaxedPawn(state, 'white')).toBeNull();
    const played = playWhiteMoves(state, TAX_EVERY);
    expect(played.eventHistory.filter(e => e.modifierId === TAX)).toHaveLength(0);
    expect(played.pieces.get('d1')).toBeDefined();
  });

  it('passing on tax day does not dodge it', () => {
    let state = withTax(PIECES());
    state = playWhiteMoves(state, TAX_EVERY - 1);
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('h8', 'g8', 'black'));
    state = chessEngine.passTurn(state);
    expect(state.pieces.get('b2')).toBeDefined();
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('g8', 'h8', 'black'));
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('d1', 'd2', 'white'));
    expect(state.pieces.get('b2')).toBeUndefined();
    expect(state.eventHistory.filter(e => e.title === 'TAXED')).toHaveLength(1);
  });

  it('never gives a Sus disguise away', () => {
    const fake = withTax([...PIECES(), makePiece('knight', 'white', 'a2', 'fake-pawn')]);
    fake.modifierState = { ...fake.modifierState, [MODIFIER_IDS.sus]: { white: { pieceId: 'fake-pawn', shownAs: 'pawn' } } };
    // The fake pawn on a2 is the rearmost "pawn": no tax this time.
    expect(getTaxedPawn(fake, 'white')).toBeNull();
    const hidden = withTax(PIECES());
    hidden.modifierState = { ...hidden.modifierState, [MODIFIER_IDS.sus]: { white: { pieceId: 'white-pawn-b2', shownAs: 'knight' } } };
    // b2 looks like a knight, so c2 is taken.
    expect(getTaxedPawn(hidden, 'white')).toBe('c2');
  });

  it('only taxes its owner', () => {
    let state = withTax(PIECES());
    state = playWhiteMoves(state, TAX_EVERY);
    expect(state.pieces.get('g7')).toBeDefined();
  });

  it('and MINE! both hit on the 40th move without a clash (interaction)', () => {
    let state = withTax(PIECES(), [{ id: MODIFIER_IDS.mine, sourceColor: 'white' }]);
    state = playWhiteMoves(state, 40);
    expect(state.status).toBe('active');
    // 4 taxes would want 4 pawns; there were 3, so all are gone and the curse ended.
    expect(Array.from(state.pieces.values()).filter(p => p.color === 'white' && p.type === 'pawn')).toHaveLength(0);
  });

  it('cannot be drafted with The Small Council', () => {
    const ids = getValidOptions([MODIFIER_IDS.smallCouncil], [], new Set([TAX, MODIFIER_IDS.smallCouncil])).map(o => o.id);
    expect(ids).not.toContain(TAX);
  });
});
