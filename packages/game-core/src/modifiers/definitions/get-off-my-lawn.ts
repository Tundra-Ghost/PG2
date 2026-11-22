import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { canMovePieceTo, offset, shiftPiece } from '../../engine/push';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.getOffMyLawn;

/** Own turns the King waits after shooing pawns. */
export const LAWN_COOLDOWN = 8;

/**
 * Enemy pawns next to the King that can be pushed, each with the square
 * behind it (toward its own side). "Pawn" means what the King's owner sees,
 * so a Sus disguise is never given away, and pawns hidden by fog are left
 * alone so the button never reveals them.
 */
export function getLawnPushes(state: GameState, king: Piece): { from: Square; to: Square }[] {
  const pushes: { from: Square; to: Square }[] = [];
  const visible = getVisibleSquares(state, king.color);
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const sq = offset(king.square, df, dr);
      const piece = sq ? state.pieces.get(sq) : undefined;
      if (!sq || !piece || piece.color === king.color) continue;
      if (visible && !visible.has(sq)) continue;
      if (getShownType(state, piece, king.color) !== 'pawn') continue;
      const back = offset(sq, 0, piece.color === 'white' ? -1 : 1);
      // Not onto Lava, storm or the pawn's own back rank.
      if (canMovePieceTo(state, piece, back, { shownType: 'pawn' })) pushes.push({ from: sq, to: back });
    }
  }
  return pushes;
}

/** MOD-C017: every enemy pawn next to your King steps one square back. */
export const getOffMyLawnDef: ModifierDefinition = {
  id: ID,
  name: 'Get Off My Lawn',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Get off my lawn',
    hint: 'Every enemy pawn next to your King is pushed one square back, if that square is empty. Tap the King again.',
    pieceTypes: ['king'],
    cooldown: LAWN_COOLDOWN,
    // The King stays put: its own square is the target.
    getTargets: (state, king) => (getLawnPushes(state, king).length > 0 ? [king.square] : []),
    apply(state, move) {
      const king = state.pieces.get(move.from)!;
      const pushes = getLawnPushes(state, king);
      const next = cloneState(state);
      // Every target was checked empty on the board before any pawn moved,
      // so no push lands on another pawn's start or target square.
      for (const { from, to } of pushes) shiftPiece(next, from, to);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'GET OFF MY LAWN',
          message: `The ${king.color} king shoos ${pushes.length === 1 ? 'a pawn' : `${pushes.length} pawns`} back.`,
          squares: pushes.flatMap(p => [p.from, p.to]),
        }),
      };
    },
    notation(_state, move) {
      return `K${move.from} lawn`;
    },
  },
};
