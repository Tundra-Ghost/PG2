import type { Color, GameState } from './types';

/**
 * Moves each side has made so far. Before the first move is recorded the
 * sides are assumed to have taken turns from white, apart from extra turns
 * in the history (puzzles, tests and older saves rely on this).
 */
export function ownMovesMade(state: GameState): Record<Color, number> {
  if (state.ownMoves) return state.ownMoves;
  // Older saves have no ownMoves: rebuild it, counting tempo-token extra turns.
  const extra: Record<Color, number> = { white: 0, black: 0 };
  for (const record of state.moveHistory) {
    if (record.move.extraTurn) extra[record.move.playerColor] += 1;
  }
  const alternating = Math.max(0, state.turnNumber - 1 - extra.white - extra.black);
  return { white: Math.ceil(alternating / 2) + extra.white, black: Math.floor(alternating / 2) + extra.black };
}
