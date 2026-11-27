import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityChoices, getAbilityOptions } from '../engine/abilities';
import type { GameState } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { getMoneyballLedger } from './definitions/moneyball';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.moneyball;
const moneyball = { id: ID, name: 'Moneyball', activeFor: 'both' as const, sourceColor: 'white' as const };

function withMoneyball(state: GameState, tokens = 0, pool: string[] = []): GameState {
  state.activeModifiers = [moneyball];
  if (tokens > 0) state.modifierState[ID] = { white: { tokens, pool } };
  return state;
}

describe('Moneyball', () => {
  it('earns a token when the owner loses a piece, capped at 1', () => {
    let state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('knight', 'white', 'd5'),
      makePiece('bishop', 'white', 'c4'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'e6'),
    ]));
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('e6', 'd5', 'black'));
    expect(getMoneyballLedger(state, 'white')).toEqual({ tokens: 1, pool: ['knight'] });
    expect(getMoneyballLedger(state, 'black').tokens).toBe(0);
    // A second loss adds to the pool but not past one token.
    state = chessEngine.applyMove(state, move('e1', 'e2', 'white'));
    state = chessEngine.applyMove(state, move('d5', 'c4', 'black'));
    expect(getMoneyballLedger(state, 'white')).toEqual({ tokens: 1, pool: ['knight', 'bishop'] });
  });

  it('lets the King drop a lost piece, costing the token and the turn', () => {
    let state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]), 1, ['knight']);
    const option = getAbilityOptions(state, 'a1').find(o => o.modifierId === ID)!;
    expect(option.status).toBe('1 token');
    expect(option.targets).toContain('d3');
    expect(getAbilityChoices(state, 'a1', 'd3', ID)).toEqual(['knight']);

    state = chessEngine.applyMove(state, move('a1', 'd3', 'white', { ability: ID, dropType: 'knight' }));
    expect(state.pieces.get('d3')).toMatchObject({ type: 'knight', color: 'white' });
    expect(state.pieces.get('a1')?.type).toBe('king');
    expect(state.turn).toBe('black');
    expect(getMoneyballLedger(state, 'white')).toEqual({ tokens: 0, pool: [] });
    expect(state.moveHistory[state.moveHistory.length - 1]?.notation).toBe('N@d3');
  });

  it('refuses drops that give check and pawn drops on the back ranks', () => {
    const state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'e4'),
    ]), 1, ['knight', 'pawn']);
    // A knight on d2 or f2 would check the e4 king.
    expect(getAbilityChoices(state, 'a1', 'd2', ID)).toEqual(['pawn']);
    expect(getAbilityChoices(state, 'a1', 'f2', ID)).toEqual(['pawn']);
    expect(getAbilityChoices(state, 'a1', 'c1', ID)).toEqual(['knight']);
    const bad = chessEngine.validateMove(state, move('a1', 'd2', 'white', { ability: ID, dropType: 'knight' }));
    expect(bad.valid).toBe(false);
  });

  it('drops only on the owner first three ranks', () => {
    const white = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]), 1, ['rook']);
    const targets = getAbilityOptions(white, 'a1').find(o => o.modifierId === ID)!.targets;
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every(sq => '123'.includes(sq[1]))).toBe(true);
    expect(getAbilityChoices(white, 'a1', 'd4', ID)).toEqual([]);
    expect(chessEngine.validateMove(white, move('a1', 'd5', 'white', { ability: ID, dropType: 'rook' })).valid).toBe(false);

    const black = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]));
    black.activeModifiers = [{ ...moneyball, sourceColor: 'black' }];
    black.modifierState[ID] = { black: { tokens: 1, pool: ['rook'] } };
    black.turn = 'black';
    const blackTargets = getAbilityOptions(black, 'h8').find(o => o.modifierId === ID)!.targets;
    expect(blackTargets.length).toBeGreaterThan(0);
    expect(blackTargets.every(sq => '678'.includes(sq[1]))).toBe(true);
  });

  it('has no targets without a token, and none for the other side', () => {
    const state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]));
    expect(getAbilityOptions(state, 'a1').find(o => o.modifierId === ID)?.targets).toEqual([]);
    state.turn = 'black';
    expect(getAbilityOptions(state, 'h8').find(o => o.modifierId === ID)).toBeUndefined();
  });
});
