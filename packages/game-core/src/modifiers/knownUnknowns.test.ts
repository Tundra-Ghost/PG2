import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { getVisibleSquares } from '../engine/visibility';
import { MODIFIER_IDS } from './ids';
import { BLIND_SPOT_SHIFT_PLIES, getBlindSpot, knownUnknownsDef } from './definitions/known-unknowns';
import { makeEmptyState, makePiece } from './testHelpers';

const card = { id: MODIFIER_IDS.knownUnknowns, name: 'Known Unknowns', activeFor: 'both' as const, sourceColor: null };

function withCard() {
  const state = makeEmptyState([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')]);
  state.activeModifiers = [card];
  return knownUnknownsDef.onActivate!(state);
}

describe('Known Unknowns', () => {
  it('gives each side a 2x2 blind spot in the middle that does not overlap', () => {
    for (let seed = 1; seed < 40; seed++) {
      const base = withCard();
      base.prngState = seed;
      const state = knownUnknownsDef.onActivate!(base);
      const white = getBlindSpot(state, 'white');
      const black = getBlindSpot(state, 'black');
      expect(white).toHaveLength(4);
      expect(black).toHaveLength(4);
      expect(white.some(sq => black.includes(sq))).toBe(false);
      for (const sq of [...white, ...black]) expect(Number(sq[1])).toBeGreaterThanOrEqual(3);
      for (const sq of [...white, ...black]) expect(Number(sq[1])).toBeLessThanOrEqual(6);
    }
  });

  it('hides enemy pieces inside your blind spot but not your own', () => {
    const state = withCard();
    const [inside] = getBlindSpot(state, 'white');
    state.pieces.set(inside, makePiece('rook', 'black', inside));
    expect(getVisibleSquares(state, 'white')!.has(inside)).toBe(false);
    expect(getVisibleSquares(state, 'black')!.has(inside)).toBe(true);
    state.pieces.set(inside, makePiece('rook', 'white', inside));
    expect(getVisibleSquares(state, 'white')!.has(inside)).toBe(true);
  });

  it('moves the blind spots every 15 rounds', () => {
    let state = chessEngine.getInitialState();
    state.activeModifiers = [card];
    state = knownUnknownsDef.onActivate!(state);
    const before = getBlindSpot(state, 'black').join();
    state.moveHistory = new Array(BLIND_SPOT_SHIFT_PLIES - 1).fill(state.moveHistory[0]);
    const after = knownUnknownsDef.onPostMove!(state, { from: 'e2', to: 'e4' } as never);
    expect(after.eventHistory[after.eventHistory.length - 1]?.message).toBe('The blind spots shift.');
    expect(getBlindSpot(after, 'black').join()).not.toBe(before);
  });

  it('has no blind spot without the card', () => {
    expect(getBlindSpot(chessEngine.getInitialState(), 'white')).toEqual([]);
  });
});
