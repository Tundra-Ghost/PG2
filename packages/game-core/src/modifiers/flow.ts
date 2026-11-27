import type { GameState, Square } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { beltDirection } from './definitions/factory-must-grow';

/** A direction drawn on a square, as seen from White's side. */
export type Flow = 'north' | 'south' | 'east' | 'west';

const FILES = 'abcdefgh';

/**
 * The arrows the board draws for cards that move pieces one way: the
 * conveyor belts (MOD-A010). Empty without such a card.
 */
export function getFlowArrows(state: GameState): Map<Square, Flow[]> {
  const arrows = new Map<Square, Flow[]>();
  const active = new Set(state.activeModifiers.map(mod => mod.id));
  const add = (sq: Square, flow: Flow) => arrows.set(sq, [...(arrows.get(sq) ?? []), flow]);
  if (active.has(MODIFIER_IDS.factoryMustGrow)) {
    for (const f of FILES) for (const r of ['4', '5']) {
      const sq = `${f}${r}` as Square;
      add(sq, beltDirection(sq)!);
    }
  }
  return arrows;
}
