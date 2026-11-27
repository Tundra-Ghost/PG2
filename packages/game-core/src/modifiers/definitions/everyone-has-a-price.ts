import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { getHiddenPieceIds, getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getShownType } from './sus';
import { isCup } from './shell-game';

const ID = MODIFIER_IDS.everyoneHasAPrice;

/** Own turns the Queen waits after a bribe (card type line). */
export const BRIBE_COOLDOWN = 12;

/**
 * Ranks a pawn of `color` may be bribed on: its own half, but never where it
 * could promote for its new side on the next move (the card's balance note).
 * That is the rank next to its own back rank, and also the one after it when
 * the briber has Zerg Rush (double steps from any rank).
 */
function onBribableRank(state: GameState, color: Color, square: Square): boolean {
  const rank = Number(square[1]);
  const briber: Color = color === 'white' ? 'black' : 'white';
  if (affectsColor(state, MODIFIER_IDS.zergRush, briber)) return color === 'white' ? rank === 4 : rank === 5;
  return color === 'white' ? rank === 3 || rank === 4 : rank === 5 || rank === 6;
}

/** The board after the pawn on `square` joins `color`. */
function withBribe(state: GameState, square: Square, color: Color): GameState {
  const next = cloneState(state);
  const pawn = next.pieces.get(square)!;
  next.pieces.set(square, { ...pawn, color, cooldowns: {}, abilityCooldowns: {}, isTouched: false, isShielded: false, isTraitor: false });
  next.flags.enPassantSquare = null;
  return next;
}

/**
 * Enemy pawns next to the Queen that would take the bribe: a real pawn that
 * also looks like one (not a Sus disguise or a Shell Game cup), in sight, on
 * its own half, and whose switch puts no King in check.
 */
export function getBribes(state: GameState, queen: Piece): Square[] {
  const enemy: Color = queen.color === 'white' ? 'black' : 'white';
  const visible = getVisibleSquares(state, queen.color);
  const hidden = getHiddenPieceIds(state, queen.color);
  const out: Square[] = [];
  for (const [df, dr] of ALL_DIRECTIONS) {
    const sq = offset(queen.square, df, dr);
    if (!sq) continue;
    const pawn = state.pieces.get(sq);
    if (!pawn || pawn.color !== enemy || pawn.type !== 'pawn') continue;
    if ((visible && !visible.has(sq)) || hidden.has(pawn.id)) continue;
    if (getShownType(state, pawn, queen.color) !== 'pawn' || isCup(state, pawn, queen.color)) continue;
    if (!onBribableRank(state, enemy, sq)) continue;
    // A bribed pawn may not give check on the move it changes sides.
    if (isInCheck(withBribe(state, sq, queen.color), enemy)) continue;
    out.push(sq);
  }
  return out;
}

/** MOD-C019: the Queen bribes an adjacent enemy pawn on its own half to join her side. */
export const everyoneHasAPriceDef: ModifierDefinition = {
  id: ID,
  name: 'Everyone Has A Price',
  category: 'C',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Bribe',
    hint: 'Pick an enemy pawn next to the Queen, on its own half. It joins your side. Uses your move.',
    pieceTypes: ['queen'],
    entersTarget: false,
    cooldown: BRIBE_COOLDOWN,
    getTargets: (state, queen) => getBribes(state, queen),
    apply(state, move) {
      const queen = state.pieces.get(move.from)!;
      const next = withBribe(state, move.to, queen.color);
      next.flags.halfMoveClock = 0;
      const was = queen.color === 'white' ? 'black' : 'white';
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Everyone Has A Price',
          message: `The ${queen.color} queen bribes the ${was} pawn on ${move.to}. It joins ${queen.color}.`,
          squares: [move.to],
        }),
      };
    },
    notation: (_state, move) => `Q${move.from}$${move.to}`,
  },
};
