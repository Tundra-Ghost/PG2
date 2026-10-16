import type { ModifierDefinition } from '../types';
import { slidingMoves } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.didIDoThat;

/** MOD-C003: once every 6 turns, a knight moves like a rook. */
export const didIDoThatDef: ModifierDefinition = {
  id: ID,
  name: 'Did I Do That? (Oops)',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Oops: rook move',
    hint: 'This knight moves like a rook this turn. It can capture.',
    pieceTypes: ['knight'],
    cooldown: 6,
    getTargets: (state, piece) => slidingMoves(state, piece, [[1, 0], [-1, 0], [0, 1], [0, -1]]),
  },
};
