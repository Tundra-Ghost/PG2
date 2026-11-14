import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState, isPromotionMove } from '../../engine/gameLoop';
import { isVoidSquare } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.gottaGoFast;

/** Own turns a pawn waits after a dash. */
export const DASH_COOLDOWN = 4;

function open(state: GameState, sq: Square): boolean {
  return !state.pieces.has(sq) && !isVoidSquare(state, sq);
}

/**
 * The square two ahead of the pawn when both squares are empty, from any rank.
 * A dash never ends on a promotion square: it cannot promote.
 */
export function getDashTarget(state: GameState, pawn: Piece): Square | null {
  const dir = pawn.color === 'white' ? 1 : -1;
  const rank = Number(pawn.square[1]);
  const file = pawn.square[0];
  const one = rank + dir;
  const two = rank + 2 * dir;
  if (two < 1 || two > 8) return null;
  const oneSq = `${file}${one}` as Square;
  const twoSq = `${file}${two}` as Square;
  if (!open(state, oneSq) || !open(state, twoSq)) return null;
  // A pawn that would promote on the first square cannot dash past it.
  if (isPromotionMove(state, pawn.square, oneSq) || isPromotionMove(state, pawn.square, twoSq)) return null;
  return twoSq;
}

/** MOD-C020: a pawn dashes two squares forward from any rank. No capture. */
export const gottaGoFastDef: ModifierDefinition = {
  id: ID,
  name: 'Gotta Go Fast',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Dash',
    hint: 'This pawn runs two squares forward. No capture.',
    pieceTypes: ['pawn'],
    cooldown: DASH_COOLDOWN,
    getTargets(state, piece) {
      const target = getDashTarget(state, piece);
      return target ? [target] : [];
    },
    apply(state, move) {
      const pawn = state.pieces.get(move.from)!;
      const next = cloneState(state);
      next.pieces.delete(move.from);
      next.pieces.set(move.to, { ...pawn, square: move.to });
      // No en passant can be taken against a dash.
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock = 0;
      const dashed = appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'GOTTA GO FAST',
        message: `The ${pawn.color} pawn dashes from ${move.from} to ${move.to}.`,
        squares: [move.from, move.to],
      });
      return { state: dashed };
    },
  },
};
