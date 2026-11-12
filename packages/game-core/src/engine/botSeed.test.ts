import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { chessEngine } from './ChessEngine';
import { getChickBotMove, getPigeonBotMove } from './bot';
import { botRandom, seededRandom } from './prng';

function opening(seed: number) {
  const state = chessEngine.getInitialState();
  state.prngSeed = seed;
  state.prngState = seed;
  return state;
}

describe('seeded bot randomness', () => {
  it('gives the same numbers for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    for (const n of first) expect(n >= 0 && n < 1).toBe(true);
  });

  it('changes with the ply, so the bot does not repeat one pattern', () => {
    const state = opening(7);
    const later = { ...state, moveHistory: [...state.moveHistory, state.moveHistory[0]] };
    expect(botRandom(state)()).not.toBe(botRandom(later)());
  });

  it('picks the same move for the same game, so replays match', () => {
    for (const seed of [1, 2, 3]) {
      expect(getChickBotMove(opening(seed), 'white')).toEqual(getChickBotMove(opening(seed), 'white'));
      const pigeon = { depth: 1, timeBudgetMs: Infinity };
      expect(getPigeonBotMove(opening(seed), 'white', pigeon)).toEqual(getPigeonBotMove(opening(seed), 'white', pigeon));
    }
  });

  it('still varies between games with different seeds', () => {
    const moves = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const move = getChickBotMove(opening(seed), 'white');
      moves.add(`${move?.from}${move?.to}`);
    }
    expect(moves.size).toBeGreaterThan(3);
  });
});
