import type { GameState, Move, Square } from '../engine/types';
import { cloneState } from '../engine/gameLoop';
import { checkAbilityMove, performAbility } from '../engine/abilities';

/**
 * The "cannot be captured" check from Hold My Bread (MOD-C013), shared with
 * Crop Circles (MOD-A019).
 */
/** The piece this move would capture: the target square, en passant, or whatever an ability removes. */
export function capturedIds(state: GameState, move: Move): string[] {
  if (move.ability) {
    // Abilities can remove pieces away from their target (a rook shot, a backwards swipe).
    // Hooks run before the engine checks the ability, so check it here first.
    if (checkAbilityMove(state, move)) return [];
    const before = new Set(Array.from(state.pieces.values(), p => p.id));
    const after = performAbility(cloneState(state), move).state;
    for (const p of after.pieces.values()) before.delete(p.id);
    return [...before];
  }
  const mover = state.pieces.get(move.from);
  const target = state.pieces.get(move.to);
  if (target && target.color !== move.playerColor) return [target.id];
  if (mover?.type === 'pawn' && move.to === state.flags.enPassantSquare && move.to[0] !== move.from[0]) {
    const passed = state.pieces.get(`${move.to[0]}${move.from[1]}` as Square);
    if (passed && passed.color !== move.playerColor) return [passed.id];
  }
  return [];
}
