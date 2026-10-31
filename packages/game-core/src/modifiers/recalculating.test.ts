import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { getFakeMoveHints } from './definitions/recalculating';

describe('Recalculating…', () => {
  it('adds 1 or 2 stable fake dots that are never real moves', () => {
    const state = chessEngine.getInitialState();
    expect(getFakeMoveHints(state, 'g1', chessEngine.getLegalMoves(state, 'g1'))).toEqual([]);

    state.activeModifiers = [{ id: MODIFIER_IDS.recalculating, name: 'Recalculating…', activeFor: 'both', sourceColor: null }];
    const real = chessEngine.getLegalMoves(state, 'g1');
    const fakes = getFakeMoveHints(state, 'g1', real);
    expect(fakes.length).toBeGreaterThanOrEqual(1);
    expect(fakes.length).toBeLessThanOrEqual(2);
    for (const sq of fakes) {
      expect(real).not.toContain(sq);
      expect(state.pieces.get(sq)?.color).not.toBe('white');
    }
    expect(getFakeMoveHints(state, 'g1', real)).toEqual(fakes);
  });
});
