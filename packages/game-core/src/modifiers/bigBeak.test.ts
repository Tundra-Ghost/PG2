import { describe, expect, it } from 'vitest';
import './index';
import { getVisibleSquares } from '../engine/visibility';
import { MODIFIER_IDS } from './ids';
import { bigBeakDef, getSurveillanceSquare, REVEAL_PLIES } from './definitions/big-beak';
import { makeEmptyState, makePiece, move } from './testHelpers';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };
const beak = { id: MODIFIER_IDS.bigBeak, name: 'Big Beak', activeFor: 'both' as const, sourceColor: null };

function setup() {
  const state = makeEmptyState([
    makePiece('king', 'white', 'a1'),
    makePiece('king', 'black', 'h8'),
    makePiece('knight', 'black', 'e5'),
  ]);
  state.activeModifiers = [dark, beak];
  state.modifierState = { ...state.modifierState, [MODIFIER_IDS.bigBeak]: { eye: 'd5', seen: {} } };
  return state;
}

describe('Big Beak Is Watching', () => {
  it('places the eye in the middle of the board', () => {
    for (let seed = 1; seed < 30; seed++) {
      const state = makeEmptyState([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')]);
      state.activeModifiers = [beak];
      state.prngState = seed;
      const eye = getSurveillanceSquare(bigBeakDef.onActivate!(state))!;
      expect('cdef').toContain(eye[0]);
      expect(Number(eye[1])).toBeGreaterThanOrEqual(3);
      expect(Number(eye[1])).toBeLessThanOrEqual(6);
    }
  });

  it('reveals a piece that moves next to the eye through fog for 3 rounds', () => {
    let state = setup();
    expect(getVisibleSquares(state, 'white')!.has('e5')).toBe(false);
    state = bigBeakDef.onPostMove!(state, move('f7', 'e5', 'black'));
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('Big Beak spots the black knight on e5.');
    expect(getVisibleSquares(state, 'white')!.has('e5')).toBe(true);
    state.moveHistory = new Array(REVEAL_PLIES).fill(undefined);
    expect(getVisibleSquares(state, 'white')!.has('e5')).toBe(true);
    state.moveHistory = new Array(REVEAL_PLIES + 1).fill(undefined);
    expect(getVisibleSquares(state, 'white')!.has('e5')).toBe(false);
  });

  it('ignores moves far from the eye', () => {
    const state = setup();
    state.pieces.set('h5', makePiece('rook', 'black', 'h5'));
    const after = bigBeakDef.onPostMove!(state, move('h6', 'h5', 'black'));
    expect(after).toBe(state);
  });
});
