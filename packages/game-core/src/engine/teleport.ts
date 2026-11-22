import type { GameState, Piece, Square } from './types';
import { cloneState } from './gameLoop';
import { isInCheck } from './moveGenerator';

export interface TeleportResult {
  state: GameState;
  /** The piece that stood on the exit, if the jump may capture. */
  taken?: Piece;
}

/**
 * Moves the piece on `from` straight to `to`, as a vent or a portal does.
 * Returns null when the jump is jammed: the exit is void (a wall, a flock,
 * the statue), holds a King, holds any piece when `capture` is false, or the
 * jump would leave the mover's own King in check. Never moves a King.
 */
export function teleport(state: GameState, from: Square, to: Square, { capture }: { capture: boolean }): TeleportResult | null {
  const piece = state.pieces.get(from);
  if (!piece || piece.type === 'king' || from === to) return null;
  if (state.tiles.get(to)?.isVoid) return null;
  const occupant = state.pieces.get(to);
  if (occupant && (!capture || occupant.type === 'king')) return null;
  const next = cloneState(state);
  next.pieces.delete(from);
  next.pieces.set(to, { ...piece, square: to });
  if (isInCheck(next, piece.color)) return null;
  return { state: next, ...(occupant ? { taken: occupant } : {}) };
}
