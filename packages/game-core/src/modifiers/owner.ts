import type { Color, GameState, ModifierID } from '../engine/types';
import { ownMovesMade } from '../engine/ownMoves';

/**
 * The side that drafted the most recently activated instance of a modifier.
 * Use it in onActivate, which runs once per drafted instance. Null means the
 * modifier was activated without a draft source and applies to both sides.
 */
export function getModifierOwner(state: GameState, id: ModifierID): Color | null {
  return [...state.activeModifiers].reverse().find(mod => mod.id === id)?.sourceColor ?? null;
}

/** True if any active instance of the modifier applies to `color`. Both sides may draft an owned card. */
export function affectsColor(state: GameState, id: ModifierID, color: Color): boolean {
  return state.activeModifiers.some(
    mod => mod.id === id && (mod.sourceColor == null || mod.sourceColor === color),
  );
}

/**
 * The every-N-moves counter: 1 on a side's first move, 2 on its second, and
 * so on, counting the move being made now (or about to be made, at turn
 * start). Shared by the scheduled curses so they count the same way. Extra
 * turns, passes and skipped turns all count.
 */
export function ownMoveNumber(state: GameState, color: Color = state.turn): number {
  return ownMovesMade(state)[color] + 1;
}
