import type { Color, GameState } from './types';
import { cloneState } from './gameLoop';

/** Ends an active game: the given side gives up. */
export function resign(state: GameState, color: Color): GameState {
  if (state.status !== 'active') return state;
  const next = cloneState(state);
  next.status = 'resigned';
  next.resignedBy = color;
  return next;
}

/** Ends an active game as a draw both players agreed to. */
export function drawByAgreement(state: GameState): GameState {
  if (state.status !== 'active') return state;
  const next = cloneState(state);
  next.status = 'draw';
  next.drawReason = 'agreement';
  return next;
}

/** Who won a finished game, 'draw', or null while it is still going. */
export function getWinner(state: GameState): Color | 'draw' | null {
  switch (state.status) {
    case 'checkmate':
      // The side to move is the one that got mated.
      return state.turn === 'white' ? 'black' : 'white';
    case 'resigned':
      return state.resignedBy === 'white' ? 'black' : 'white';
    case 'draw':
      return 'draw';
    default:
      return null;
  }
}
