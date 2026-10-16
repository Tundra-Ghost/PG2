import type { ModifierDefinition } from '../types';
import type { Color, Square } from '../../engine/types';
import { cloneState, positionKey } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.smallCouncil;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
// The 4 extra pawns stand where the knights and bishops would be.
const EXTRA_FILES = ['b', 'c', 'f', 'g'] as const;

/**
 * MOD-E002: no knights or bishops. 12 pawns: a full line one rank forward
 * (rank 3 / rank 6) plus 4 pawns behind it on b, c, f and g.
 */
export function buildSmallCouncilArmy(color: Color): Square[] {
  const front = color === 'white' ? '3' : '6';
  const back = color === 'white' ? '2' : '7';
  return [
    ...FILES.map(f => `${f}${front}` as Square),
    ...EXTRA_FILES.map(f => `${f}${back}` as Square),
  ];
}

export const smallCouncilDef: ModifierDefinition = {
  id: ID,
  name: 'The Small Council',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    // Only rebuild the army before the first move.
    if (state.moveHistory.length > 0) return state;

    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);

    for (const color of colors) {
      for (const [sq, piece] of next.pieces) {
        if (piece.color !== color) continue;
        if (piece.type === 'pawn' || piece.type === 'knight' || piece.type === 'bishop') {
          next.pieces.delete(sq);
        }
      }
      for (const square of buildSmallCouncilArmy(color)) {
        next.pieces.set(square, {
          id: `${color}-council-pawn-${square}`,
          type: 'pawn',
          color,
          square,
          cooldowns: {},
        });
      }
    }

    // The new start position is the one that counts for repetition.
    next.positionHistory = { [positionKey(next)]: 1 };
    return next;
  },
};
