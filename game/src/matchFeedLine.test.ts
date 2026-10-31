import { describe, expect, it } from 'vitest';
import { buildMove, chessEngine, type GameState } from '@pigeon-chess/game-core';
import { latestFeedLine } from './matchFeed';

const start = (): GameState => chessEngine.beginTurn(chessEngine.getInitialState());
const play = (state: GameState, from: string, to: string) =>
  chessEngine.applyMove(state, buildMove(state, from as never, to as never));

describe('latestFeedLine', () => {
  it('starts empty, then names the side that just moved', () => {
    expect(latestFeedLine(start(), 'Ana', 'Chick')).toBe('No moves yet.');
    const first = play(start(), 'e2', 'e4');
    expect(latestFeedLine(first, 'Ana', 'Chick')).toMatch(/^Ana plays: /);
    expect(latestFeedLine(play(first, 'e7', 'e5'), 'Ana', 'Chick')).toMatch(/^Chick plays: /);
  });

  it('shows a modifier event from the latest move, in player names', () => {
    const state = play(start(), 'e2', 'e4');
    const withEvent: GameState = {
      ...state,
      eventHistory: [{ ...({} as GameState['eventHistory'][number]), id: 'x', ply: 1, title: 'Lava', message: 'white pawn melts' }],
    };
    expect(latestFeedLine(withEvent, 'Ana', 'Chick')).toBe("Lava: Ana's pawn melts");
  });
});
