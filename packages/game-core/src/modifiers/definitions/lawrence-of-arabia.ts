import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';
import { remapDisguise } from './sus';

const ID = MODIFIER_IDS.lawrenceOfArabia;

/**
 * MOD-E011 Lawrence Of Arabia: the owner's starting knights become Camels,
 * (3,1) leapers (see moveGenerator). Ghost knights become Ghost Camels and a
 * Sus disguise shows a Camel, not a knight, so neither gives itself away.
 */
export const lawrenceOfArabiaDef: ModifierDefinition = {
  id: ID,
  name: 'Lawrence Of Arabia',
  category: 'E',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const piece of next.pieces.values()) {
      if (piece.type === 'knight' && colors.includes(piece.color)) {
        next.pieces.set(piece.square, { ...piece, type: 'camel' });
      }
    }
    for (const color of colors) remapDisguise(next, color, 'knight', 'camel');
    return next;
  },
};
