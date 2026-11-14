import { describe, expect, it } from 'vitest';
import { chessEngine } from '@pigeon-chess/game-core';
import { shouldAskBeforeLeaving } from './leaveMatch';

function afterOneMove() {
  const start = chessEngine.beginTurn(chessEngine.getInitialState());
  return chessEngine.applyMove(start, { from: 'e2', to: 'e4', playerColor: 'white' });
}

const base = { confirmResign: true, hasProfile: true, recordedIds: new Set<string>() };

describe('asking before leaving a match', () => {
  it('asks once a move is made in an active match', () => {
    expect(shouldAskBeforeLeaving({ ...base, state: afterOneMove() })).toBe(true);
  });

  it('does not ask before the first move, since nothing is recorded', () => {
    expect(shouldAskBeforeLeaving({ ...base, state: chessEngine.getInitialState() })).toBe(false);
  });

  it('does not ask when the match is over or already recorded', () => {
    const state = afterOneMove();
    expect(shouldAskBeforeLeaving({ ...base, state: { ...state, status: 'checkmate' } })).toBe(false);
    expect(shouldAskBeforeLeaving({ ...base, state, recordedIds: new Set([state.id]) })).toBe(false);
  });

  it('follows the Confirm Before Resign setting', () => {
    expect(shouldAskBeforeLeaving({ ...base, confirmResign: false, state: afterOneMove() })).toBe(false);
  });
});
