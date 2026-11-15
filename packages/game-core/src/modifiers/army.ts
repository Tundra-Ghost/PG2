import type { Color, GameState, PieceType } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { affectsColor } from './owner';

/**
 * Cards that swap a whole piece type for their owner. Ghosts and Sus
 * disguises copy the swap so they never stand out as the only plain piece.
 */
const ARMY_SWAPS: ReadonlyArray<{ card: string; from: PieceType; to: PieceType }> = [
  { card: MODIFIER_IDS.elephantInTheRoom, from: 'bishop', to: 'elephant' },
  { card: MODIFIER_IDS.lawrenceOfArabia, from: 'knight', to: 'camel' },
];

/** The type `color`'s army uses in place of `type`. */
export function armyType(state: GameState, color: Color, type: PieceType): PieceType {
  for (const swap of ARMY_SWAPS) {
    if (swap.from === type && affectsColor(state, swap.card, color)) return swap.to;
  }
  return type;
}
