import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';
import { remapDisguise } from './sus';

const ID = MODIFIER_IDS.elephantInTheRoom;

/**
 * MOD-E020 Elephant In The Room: the owner's starting bishops become
 * Elephants, which move one or two squares diagonally (see moveGenerator).
 * Ghost bishops (MOD-D002) become Ghost Elephants and a Sus disguise (MOD-D005)
 * shows an Elephant, not a bishop, so neither gives itself away.
 */
export const elephantInTheRoomDef: ModifierDefinition = {
  id: ID,
  name: 'Elephant In The Room',
  category: 'E',
  pointCost: -3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const piece of next.pieces.values()) {
      if (piece.type === 'bishop' && colors.includes(piece.color)) {
        next.pieces.set(piece.square, { ...piece, type: 'elephant' });
      }
    }
    for (const color of colors) remapDisguise(next, color, 'bishop', 'elephant');
    return next;
  },
};
