import type { GameState } from '@pigeon-chess/game-core';

/**
 * True when leaving the match now would record a loss and the player keeps
 * the Confirm Before Resign setting on, so the game should ask first.
 */
export function shouldAskBeforeLeaving(input: {
  confirmResign: boolean;
  hasProfile: boolean;
  state: Pick<GameState, 'id' | 'status' | 'moveHistory'>;
  recordedIds: ReadonlySet<string>;
}): boolean {
  const { confirmResign, hasProfile, state, recordedIds } = input;
  if (!confirmResign || !hasProfile) return false;
  if (state.status !== 'active' || state.moveHistory.length === 0) return false;
  return !recordedIds.has(state.id);
}
