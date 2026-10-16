import type { ModifierDefinition } from '../types';
import type { Color, Square } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.threeKings;

/** Where the second guard goes: in front of the pawns, as central as possible. */
function secondGuardSquare(occupied: (sq: Square) => boolean, color: Color): Square | null {
  const rank = color === 'white' ? '3' : '6';
  for (const file of ['e', 'd', 'f', 'c', 'g', 'b', 'h', 'a']) {
    const sq = `${file}${rank}` as Square;
    if (!occupied(sq)) return sq;
  }
  return null;
}

/** MOD-E003: the queen is replaced by two Royal Guards that step like kings. */
export const threeKingsDef: ModifierDefinition = {
  id: ID,
  name: 'Yeah, There Are Three Of Them',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const color of colors) {
      const queen = Array.from(next.pieces.values()).find(p => p.color === color && p.type === 'queen');
      if (!queen) continue;
      next.pieces.set(queen.square, { ...queen, type: 'royal_guard' });
      const sq = secondGuardSquare(s => next.pieces.has(s), color);
      if (sq) {
        next.pieces.set(sq, {
          id: `${color}-royal-guard-${sq}`,
          type: 'royal_guard',
          color,
          square: sq,
          cooldowns: {},
        });
      }
    }
    return next;
  },
};
