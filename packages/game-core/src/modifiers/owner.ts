import type { Color, GameState, ModifierID } from '../engine/types';

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
