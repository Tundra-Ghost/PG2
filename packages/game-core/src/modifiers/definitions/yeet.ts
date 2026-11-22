import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { canMovePieceTo, offset, ORTHOGONAL_DIRECTIONS, shiftPiece } from '../../engine/push';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.yeet;

/** Own turns the rook waits after a shove. */
export const YEET_COOLDOWN = 6;

/**
 * Enemy pieces orthogonally next to the rook that can be shoved, each with
 * the square one step further away. Never a King. The landing square must be
 * empty and real; Lava is allowed (that is what it is for). Pieces the rook's
 * owner cannot see are left alone, so the button reveals nothing.
 */
export function getYeetShoves(state: GameState, rook: Piece): { from: Square; to: Square }[] {
  const shoves: { from: Square; to: Square }[] = [];
  const visible = getVisibleSquares(state, rook.color);
  for (const [df, dr] of ORTHOGONAL_DIRECTIONS) {
    const sq = offset(rook.square, df, dr);
    const piece = sq ? state.pieces.get(sq) : undefined;
    if (!sq || !piece || piece.color === rook.color || piece.type === 'king') continue;
    if (visible && !visible.has(sq)) continue;
    const beyond = offset(sq, df, dr);
    if (visible && beyond && !visible.has(beyond)) continue;
    if (canMovePieceTo(state, piece, beyond, { allowLava: true })) shoves.push({ from: sq, to: beyond });
  }
  return shoves;
}

/** MOD-C009: the rook shoves an adjacent enemy piece one square straight away. */
export const yeetDef: ModifierDefinition = {
  id: ID,
  name: 'YEET',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'YEET',
    hint: 'Pick an enemy piece next to the rook (not the King). It is shoved one square straight away, if that square is empty.',
    pieceTypes: ['rook'],
    cooldown: YEET_COOLDOWN,
    getTargets: (state, rook) => getYeetShoves(state, rook).map(s => s.from),
    apply(state, move) {
      const rook = state.pieces.get(move.from)!;
      const shove = getYeetShoves(state, rook).find(s => s.from === move.to)!;
      const victim = state.pieces.get(shove.from)!;
      const next = cloneState(state);
      shiftPiece(next, shove.from, shove.to);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'YEET',
          message: `The ${rook.color} rook shoves the ${victim.color} ${victim.type} from ${shove.from} to ${shove.to}.`,
          squares: [shove.from, shove.to],
        }),
      };
    },
    notation: (_state, move) => `R${move.from}>${move.to}`,
  },
};
