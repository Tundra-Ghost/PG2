import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';
import { remapDisguise } from './sus';

const ID = MODIFIER_IDS.knightRider;

/**
 * MOD-E019 Knight Rider: the owner's starting knights become Nightriders,
 * which repeat one knight jump in a line (see moveGenerator). Ghost knights become
 * Ghost Nightriders and a Sus disguise shows a Nightrider, not a knight.
 */
export const knightRiderDef: ModifierDefinition = {
  id: ID,
  name: 'Knight Rider',
  category: 'E',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const piece of next.pieces.values()) {
      if (piece.type === 'knight' && colors.includes(piece.color)) {
        next.pieces.set(piece.square, { ...piece, type: 'nightrider' });
      }
    }
    for (const color of colors) remapDisguise(next, color, 'knight', 'nightrider');
    return next;
  },
};
