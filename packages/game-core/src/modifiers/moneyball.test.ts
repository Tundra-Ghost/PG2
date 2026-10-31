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
  it('earns a token when the owner loses a piece, capped at 3', () => {
    let state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('knight', 'white', 'd5'),
      makePiece('king', 'black', 'e8'),
      makePiece('pawn', 'black', 'e6'),
    ]));
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('e6', 'd5', 'black'));
    expect(getMoneyballLedger(state, 'white')).toEqual({ tokens: 1, pool: ['knight'] });
    expect(getMoneyballLedger(state, 'black').tokens).toBe(0);
  });

  it('lets the King drop a lost piece, costing the token and the turn', () => {
    let state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]), 1, ['knight']);
    const option = getAbilityOptions(state, 'a1').find(o => o.modifierId === ID)!;
    expect(option.status).toBe('1 token');
    expect(option.targets).toContain('d4');
    expect(getAbilityChoices(state, 'a1', 'd4', ID)).toEqual(['knight']);

    state = chessEngine.applyMove(state, move('a1', 'd4', 'white', { ability: ID, dropType: 'knight' }));
    expect(state.pieces.get('d4')).toMatchObject({ type: 'knight', color: 'white' });
    expect(state.pieces.get('a1')?.type).toBe('king');
    expect(state.turn).toBe('black');
    expect(getMoneyballLedger(state, 'white')).toEqual({ tokens: 0, pool: [] });
    expect(state.moveHistory[state.moveHistory.length - 1]?.notation).toBe('N@d4');
  });

  it('refuses drops that give check and pawn drops on the back ranks', () => {
    const state = withMoneyball(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]), 2, ['knight', 'pawn']);
    // A knight on f7 or g6 would check the h8 king.
    expect(getAbilityChoices(state, 'a1', 'f7', ID)).toEqual(['pawn']);
    expect(getAbilityChoices(state, 'a1', 'g6', ID)).toEqual(['pawn']);
    expect(getAbilityChoices(state, 'a1', 'c8', ID)).toEqual(['knight']);
    const bad = chessEngine.validateMove(state, move('a1', 'f7', 'white', { ability: ID, dropType: 'knight' }));
    expect(bad.valid).toBe(false);
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
