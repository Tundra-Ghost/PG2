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

/**
 * The every-N-moves counter: 1 on a side's first move, 2 on its second, and
 * so on, counting the move being made now. Shared by the scheduled curses
 * so they count the same way. Extra turns from a tempo token (MOD-C007)
 * count for the side that took them.
 */
export function ownMoveNumber(state: GameState, color: Color = state.turn): number {
  const plies = state.turnNumber - 1;
  const extra: Record<Color, number> = { white: 0, black: 0 };
  for (const record of state.moveHistory) {
    if (record.move.extraTurn) extra[record.move.playerColor] += 1;
  }
  const alternating = plies - extra.white - extra.black;
  const made = color === 'white' ? Math.ceil(alternating / 2) + extra.white : Math.floor(alternating / 2) + extra.black;
  return made + 1;
}
