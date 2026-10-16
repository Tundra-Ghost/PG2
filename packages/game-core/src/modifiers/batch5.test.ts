import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getQuietZoneSquares } from './definitions/quiet-quitting';
import { makeEmptyState, makePiece, move } from './testHelpers';

const QUIET = MODIFIER_IDS.quietQuitting;
const BANK = MODIFIER_IDS.bankedEnPassant;

function withCard(pieces: Piece[], id: string, owner: 'white' | 'black' = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id, sourceColor: owner }],
  );
}

describe('MOD-C005 Quiet Quitting', () => {
  const setup = () =>
    withCard(
      [makePiece('queen', 'white', 'd4'), makePiece('rook', 'black', 'c8'), makePiece('rook', 'black', 'h5'), makePiece('pawn', 'white', 'a2')],
      QUIET,
    );

  it('the queen stays put and enemies cannot enter her zone', () => {
    let state = setup();
    expect(getAbilityOptions(state, 'd4')[0].targets).toEqual(['d4']);
    state = chessEngine.applyMove(state, move('d4', 'd4', 'white', { ability: QUIET }));
    expect(state.pieces.get('d4')?.type).toBe('queen');
    expect(state.moveHistory[0].notation).toBe('Qd4=Z');
    expect(getQuietZoneSquares(state).get('c5')).toBe('white');
    expect(chessEngine.validateMove(state, move('c8', 'c5', 'black')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('h5', 'e5', 'black')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('c8', 'c6', 'black')).valid).toBe(true);
  });

  it('lasts 2 enemy turns', () => {
    let state = chessEngine.applyMove(setup(), move('d4', 'd4', 'white', { ability: QUIET }));
    state = chessEngine.applyMove(state, move('c8', 'c7', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    expect(chessEngine.validateMove(state, move('c7', 'c5', 'black')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('c7', 'c6', 'black'));
    state = chessEngine.applyMove(state, move('a3', 'a4', 'white'));
    expect(getQuietZoneSquares(state).size).toBe(0);
    expect(chessEngine.validateMove(state, move('c6', 'c5', 'black')).valid).toBe(true);
  });

  it('ends when the queen moves', () => {
    let state = chessEngine.applyMove(setup(), move('d4', 'd4', 'white', { ability: QUIET }));
    state = chessEngine.applyMove(state, move('c8', 'c7', 'black'));
    state = chessEngine.applyMove(state, move('d4', 'd2', 'white'));
    expect(getQuietZoneSquares(state).size).toBe(0);
    expect(chessEngine.validateMove(state, move('c7', 'c5', 'black')).valid).toBe(true);
  });
});

describe('MOD-C008 I\'ve Been Waiting For This', () => {
  const setup = () =>
    withCard(
      [makePiece('pawn', 'white', 'e5'), makePiece('pawn', 'black', 'd7'), makePiece('pawn', 'white', 'a2'), makePiece('rook', 'black', 'h8')],
      BANK,
    );

  it('banks the en passant and takes it later', () => {
    let state = setup();
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'h7', 'black'));
    expect(getAbilityOptions(state, 'e5')[0].targets).toEqual(['d6']);
    state = chessEngine.applyMove(state, move('e5', 'd6', 'white', { ability: BANK }));
    expect(state.pieces.get('d6')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.pieces.has('d5')).toBe(false);
    expect(state.moveHistory[state.moveHistory.length - 1].notation).toBe('exd6 e.p.');
  });

  it('expires after 3 own turns', () => {
    let state = setup();
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    const plies: Array<[string, string, 'white' | 'black']> = [
      ['a2', 'a3', 'white'], ['h8', 'h7', 'black'],
      ['a3', 'a4', 'white'], ['h7', 'h6', 'black'],
    ];
    for (const [from, to, color] of plies) state = chessEngine.applyMove(state, move(from as never, to as never, color));
    expect(getAbilityOptions(state, 'e5')[0].targets).toEqual(['d6']);
    state = chessEngine.applyMove(state, move('a4', 'a5', 'white'));
    state = chessEngine.applyMove(state, move('h6', 'h5', 'black'));
    expect(getAbilityOptions(state, 'e5')[0].targets).toEqual([]);
  });

  it('does nothing for the side without the card', () => {
    let state = withCard([makePiece('pawn', 'black', 'd4'), makePiece('pawn', 'white', 'e2')], BANK, 'white');
    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    expect(getAbilityOptions(state, 'd4')).toEqual([]);
  });
});
