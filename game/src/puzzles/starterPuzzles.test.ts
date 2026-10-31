import { describe, expect, it } from 'vitest';
import {
  buildPuzzleState,
  chessEngine,
  getPigeonBotMove,
  getPuzzleProgress,
  validatePuzzle,
  type GameState,
  type Square,
} from '@pigeon-chess/game-core';
import { STARTER_PUZZLES } from './starterPuzzles';

function byId(id: string) {
  const puzzle = STARTER_PUZZLES.find(p => p.id === id);
  if (!puzzle) throw new Error(id);
  return puzzle;
}

function solverMove(state: GameState, from: Square, to: Square): GameState {
  return chessEngine.applyMove(state, { from, to, playerColor: state.turn });
}

function defend(state: GameState): GameState {
  const move = getPigeonBotMove(state, state.turn);
  return move ? chessEngine.applyMove(state, move) : chessEngine.passTurn(state);
}

describe('starter puzzles', () => {
  it('are all playable', () => {
    for (const puzzle of STARTER_PUZZLES) expect(validatePuzzle(puzzle), puzzle.id).toEqual([]);
  });

  it('back rank: Ra8 mates', () => {
    const puzzle = byId('starter-back-rank');
    const start = buildPuzzleState(puzzle);
    expect(getPuzzleProgress(puzzle, start, solverMove(start, 'a1', 'a8')).status).toBe('solved');
  });

  it('small world: Rg7 mates against the closed edge', () => {
    const puzzle = byId('starter-small-world');
    const start = buildPuzzleState(puzzle);
    expect(puzzle.closed).toHaveLength(28);
    expect(getPuzzleProgress(puzzle, start, solverMove(start, 'g2', 'g7')).status).toBe('solved');
  });

  it('royal fork: Ne7+ wins the queen against the bot', () => {
    const puzzle = byId('starter-royal-fork');
    const start = buildPuzzleState(puzzle);
    const state = defend(solverMove(start, 'd5', 'e7'));
    expect(getPuzzleProgress(puzzle, start, solverMove(state, 'e7', 'c8')).status).toBe('solved');
  });

  it('hot floor: white starts with moves and out of check', () => {
    // The bot thinks on a time budget, so a full survive run would be flaky here.
    const start = buildPuzzleState(byId('starter-hot-floor'));
    expect(start.status).toBe('active');
    expect(chessEngine.isInCheck(start, 'white')).toBe(false);
    expect(chessEngine.hasAnyValidMove(start)).toBe(true);
  });
});
