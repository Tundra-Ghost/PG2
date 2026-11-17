import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, PieceType, Square } from '../../engine/types';
import { cloneState, positionKey } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.stonks;
/** b3 first; if another card already stands there, the next free square on that rank. */
const KNIGHT_FILES = ['b', 'c', 'a', 'd', 'e', 'f', 'g', 'h'] as const;

/** b3 (b6), or the next square on that rank that is empty and on the board. */
export function stonksKnightSquare(state: GameState, color: Color): Square | null {
  const rank = color === 'white' ? '3' : '6';
  for (const file of KNIGHT_FILES) {
    const sq = `${file}${rank}` as Square;
    if (!state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid) return sq;
  }
  return null;
}

/** MOD-D005: if Sus disguised a pawn Stonks sold, the disguise moves to the new knight. */
function moveSusDisguise(state: GameState, color: Color, soldIds: string[], knight: Piece | null): void {
  const disguise = state.modifierState[MODIFIER_IDS.sus] as Partial<Record<Color, { pieceId: string; shownAs: PieceType }>> | undefined;
  const mine = disguise?.[color];
  if (!mine || !soldIds.includes(mine.pieceId)) return;
  const rest = { ...disguise };
  if (knight) rest[color] = { pieceId: knight.id, shownAs: mine.shownAs === knight.type ? 'pawn' : mine.shownAs };
  else delete rest[color];
  state.modifierState = { ...state.modifierState, [MODIFIER_IDS.sus]: rest };
}

/** MOD-E015: the owner starts without the a- and h-pawns and with an extra knight on b3 (b6). */
export const stonksDef: ModifierDefinition = {
  id: ID,
  name: 'Stonks',
  category: 'E',
  pointCost: 3,
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
      const soldIds: string[] = [];
      for (const [sq, piece] of next.pieces) {
        if (piece.color === color && piece.type === 'pawn' && (sq[0] === 'a' || sq[0] === 'h')) {
          next.pieces.delete(sq);
          soldIds.push(piece.id);
        }
      }
      const square = stonksKnightSquare(next, color);
      if (!square) {
        moveSusDisguise(next, color, soldIds, null);
        continue;
      }
      // Hatoful Gambit, Lawrence Of Arabia and Knight Rider change the owner's knights, this one too.
      const type: PieceType = affectsColor(next, MODIFIER_IDS.hatofulGambit, color)
        ? 'pigeon'
        : affectsColor(next, MODIFIER_IDS.lawrenceOfArabia, color)
          ? 'camel'
          : affectsColor(next, MODIFIER_IDS.knightRider, color) ? 'nightrider' : 'knight';
      const knight: Piece = { id: `${color}-stonks-knight`, type, color, square, cooldowns: {} };
      next.pieces.set(square, knight);
      moveSusDisguise(next, color, soldIds, knight);
    }

    // The new start position is the one that counts for repetition.
    next.positionHistory = { [positionKey(next)]: 1 };
    return next;
  },
};
