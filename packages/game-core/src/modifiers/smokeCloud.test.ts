import { describe, expect, it } from 'vitest';
import './index';
import { getVisibleSquares } from '../engine/visibility';
import { MODIFIER_IDS } from './ids';
import { getSmokeSquares, SMOKE_EVERY_PLIES, SMOKE_PLIES, smokeCloudDef } from './definitions/smoke-cloud';
import { makeEmptyState, makePiece, move } from './testHelpers';

const card = { id: MODIFIER_IDS.smokeCloud, name: 'Smoke', activeFor: 'both' as const, sourceColor: null };

function setup() {
  const state = makeEmptyState([
    makePiece('king', 'white', 'a1'),
    makePiece('king', 'black', 'a8'),
    makePiece('rook', 'white', 'h8'),
  ]);
  state.activeModifiers = [card];
  return state;
}

describe('What\'s In The Cloud, Bro', () => {
  it('puts a cloud over a capture that only the capturer sees through', () => {
    let state = setup();
    state = smokeCloudDef.onCapture!(state, move('h1', 'h8', 'white'), makePiece('knight', 'black', 'h8'));
    expect([...getSmokeSquares(state).keys()].sort()).toEqual(['g7', 'g8', 'h7', 'h8']);
    expect(getVisibleSquares(state, 'black')!.has('h8')).toBe(false);
    expect(getVisibleSquares(state, 'white')!.has('h8')).toBe(true);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('Smoke rolls over g7-h8. The white side sees through it.');
  });

  it('clears after 3 rounds', () => {
    let state = setup();
    state = smokeCloudDef.onCapture!(state, move('h1', 'h8', 'white'), makePiece('knight', 'black', 'h8'));
    state.moveHistory = new Array(SMOKE_PLIES).fill(undefined);
    expect(getSmokeSquares(state).size).toBe(4);
    state.moveHistory = new Array(SMOKE_PLIES + 1).fill(undefined);
    expect(getSmokeSquares(state).size).toBe(0);
    expect(getVisibleSquares(state, 'black')!.has('h8')).toBe(true);
  });

  it('drops a timed cloud every 10 rounds for the side that just moved', () => {
    const state = setup();
    state.moveHistory = new Array(SMOKE_EVERY_PLIES - 1).fill(undefined);
    state.turn = 'black';
    const after = smokeCloudDef.onPostMove!(state, move('a8', 'b8', 'black'));
    const smoke = getSmokeSquares(after);
    expect(smoke.size).toBe(4);
    expect([...smoke.values()].every(owner => owner === 'black')).toBe(true);
    const quiet = setup();
    expect(smokeCloudDef.onPostMove!(quiet, move('a8', 'b8', 'black'))).toBe(quiet);
  });
});
