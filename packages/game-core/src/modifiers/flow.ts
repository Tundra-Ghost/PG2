import type { GameState, Square } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { beltDirection } from './definitions/factory-must-grow';
import { ROUNDABOUT_NEXT } from './definitions/magic-roundabout';
import { getRoombaSquare, nextOnRing } from './definitions/the-roomba';
import { oneWayDirection } from './definitions/one-way-street';

/** A direction drawn on a square, as seen from White's side. */
export type Flow = 'north' | 'south' | 'east' | 'west';

const FILES = 'abcdefgh';

/** The way from one square to a neighbour along a file or rank. */
function stepFlow(from: Square, to: Square): Flow {
  return to[0] > from[0] ? 'east' : to[0] < from[0] ? 'west' : to[1] > from[1] ? 'north' : 'south';
}

/** MOD-A015: the Roomba's square and the way it goes next, or null without the card. */
export function getRoomba(state: GameState): { square: Square; heading: Flow } | null {
  const square = getRoombaSquare(state);
  return square ? { square, heading: stepFlow(square, nextOnRing(square)) } : null;
}

/**
 * The arrows the board draws for cards that move pieces one way: the
 * conveyor belts (MOD-A010), the roundabout (MOD-A013) and the one-way files (MOD-A020). Empty without such a card.
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
  if (active.has(MODIFIER_IDS.magicRoundabout)) {
    for (const [from, to] of Object.entries(ROUNDABOUT_NEXT)) {
      add(from as Square, stepFlow(from as Square, to));
    }
  }
  if (active.has(MODIFIER_IDS.oneWayStreet)) {
    for (const f of ['c', 'f']) for (let r = 1; r <= 8; r++) add(`${f}${r}` as Square, oneWayDirection(f)!);
  }
  return arrows;
}
