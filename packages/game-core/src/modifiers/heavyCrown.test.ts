import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { getCrownOrders } from './definitions/heavy-is-the-crown';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.heavyIsTheCrown;

function cursed(pieces: Parameters<typeof makeEmptyState>[0]): GameState {
  const state = makeEmptyState(pieces);
  state.activeModifiers = [{ id: ID, name: 'Heavy Is The Crown', activeFor: 'both', sourceColor: 'white' }];
  return state;
}

describe('Heavy Is The Crown', () => {
  it('blocks a plain King move, then allows it after an order', () => {
    let state = cursed([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'black', 'a7')]);
    expect(chessEngine.validateMove(state, move('e1', 'e2', 'white')).valid).toBe(false);

    state = chessEngine.applyMove(state, move('e1', 'e2', 'white', { ability: ID }));
    expect(state.pieces.get('e1')?.type).toBe('king');
    expect(getCrownOrders(state).get('e2')).toBe('white');
    expect(state.turn).toBe('black');

    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    expect(chessEngine.validateMove(state, move('e1', 'd2', 'white')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('e1', 'e2', 'white'));
    expect(state.pieces.get('e2')?.type).toBe('king');
    expect(getCrownOrders(state).size).toBe(0);
  });

  it('only weighs on the owner', () => {
    const state = cursed([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8')]);
    state.turn = 'black';
    expect(chessEngine.validateMove(state, move('e8', 'e7', 'black')).valid).toBe(true);
  });

  it('lets a checked King move freely', () => {
    const state = cursed([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'e7')]);
    expect(chessEngine.validateMove(state, move('e1', 'd1', 'white')).valid).toBe(true);
  });

  it('does not count a lone King as stuck: ordering is a move', () => {
    const state = cursed([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8')]);
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
  });
});
