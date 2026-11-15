import type { ModifierDefinition } from '../types';
import type { Color, PieceType, Square } from '../../engine/types';
import { cloneState, positionKey } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.stonks;
/** b3 first; if another card already stands there, the next free square on that rank. */
const KNIGHT_FILES = ['b', 'c', 'a', 'd', 'e', 'f', 'g', 'h'] as const;

export function stonksKnightSquare(occupied: (sq: Square) => boolean, color: Color): Square | null {
  const rank = color === 'white' ? '3' : '6';
  for (const file of KNIGHT_FILES) {
    const sq = `${file}${rank}` as Square;
    if (!occupied(sq)) return sq;
  }
  return null;
}

/** MOD-E015: the owner starts without the a- and h-pawns and with an extra knight on b3 (b6). */
export const stonksDef: ModifierDefinition = {
  id: ID,
  name: 'Stonks',
  category: 'E',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    // Only trade before the first move.
    if (state.moveHistory.length > 0) return state;

    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);

    for (const color of colors) {
      for (const [sq, piece] of next.pieces) {
        if (piece.color === color && piece.type === 'pawn' && (sq[0] === 'a' || sq[0] === 'h')) {
          next.pieces.delete(sq);
        }
      }
      const square = stonksKnightSquare(sq => next.pieces.has(sq), color);
      if (!square) continue;
      // Hatoful Gambit, Lawrence Of Arabia and Knight Rider change the owner's knights, this one too.
      const type: PieceType = affectsColor(next, MODIFIER_IDS.hatofulGambit, color)
        ? 'pigeon'
        : affectsColor(next, MODIFIER_IDS.lawrenceOfArabia, color)
          ? 'camel'
          : affectsColor(next, MODIFIER_IDS.knightRider, color) ? 'nightrider' : 'knight';
      next.pieces.set(square, { id: `${color}-stonks-knight`, type, color, square, cooldowns: {} });
    }

    // The new start position is the one that counts for repetition.
    next.positionHistory = { [positionKey(next)]: 1 };
    return next;
  },
};
