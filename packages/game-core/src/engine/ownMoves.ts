import type { Color, GameState } from './types';

/**
 * Moves each side has made so far. Before the first move is recorded the
 * sides are assumed to have taken turns from white (puzzles and tests that
 * set turnNumber by hand rely on this).
 */
export function ownMovesMade(state: GameState): Record<Color, number> {
  if (state.ownMoves) return state.ownMoves;
  const plies = Math.max(0, state.turnNumber - 1);
  return { white: Math.ceil(plies / 2), black: Math.floor(plies / 2) };
}
