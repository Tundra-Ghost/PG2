import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece } from './testHelpers';

describe('lava burn event', () => {
  it('names the square the piece burned on, for the board animation', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [
      { id: MODIFIER_IDS.floorIsLava, name: 'The Floor Is Lava', activeFor: 'both', sourceColor: null },
    ];
    state.tiles.set('d5', { square: 'd5', effects: [{ type: 'lava', turnsRemaining: -1 }] });

    const next = chessEngine.applyMove(state, { from: 'd1', to: 'd5', playerColor: 'white' });

    expect(next.pieces.has('d5')).toBe(false);
    const burn = next.eventHistory.find(event => event.modifierId === MODIFIER_IDS.floorIsLava);
    expect(burn?.squares).toEqual(['d5']);
  });
});
