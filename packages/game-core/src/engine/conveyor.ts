import type { Color, GameState, Square } from './types';
import { canMovePieceTo, shiftPiece } from './push';
import { isInCheck } from './moveGenerator';

/**
 * Board-moving cards that shift pieces on their own at the end of a round:
 * The Factory Must Grow (A010), The Magic Roundabout (A013) and The Roomba
 * (A015). They share one rule set, built on the push helpers (engine/push.ts):
 * - A slide never captures. It needs an empty, real square (no wall, flock,
 *   statue, storm or Lava).
 * - A slide never puts a King in check: not the King that rides (it moves
 *   only to a safe square), and not a King a moved piece was shielding.
 */
const COLORS: Color[] = ['white', 'black'];

/**
 * Slides the piece on `from` to `to` on `next` (mutates it) if the rules
 * above allow it. Returns true if it moved.
 */
export function slidePieceSafely(next: GameState, from: Square, to: Square | null): boolean {
  const piece = next.pieces.get(from);
  if (!piece || !canMovePieceTo(next, piece, to)) return false;
  const safeBefore = COLORS.filter(color => !isInCheck(next, color));
  const flags = next.flags;
  shiftPiece(next, from, to);
  if (safeBefore.some(color => isInCheck(next, color))) {
    next.pieces.delete(to);
    next.pieces.set(from, piece);
    next.flags = flags;
    return false;
  }
  // A pawn that just stepped two squares and then slid can no longer be taken en passant.
  const ep = next.flags.enPassantSquare;
  if (ep && piece.type === 'pawn' && from === `${ep[0]}${ep[1] === '3' ? 4 : 5}`) {
    next.flags = { ...next.flags, enPassantSquare: null };
  }
  return true;
}

/**
 * True at the first turn start of a new round (after Black's move, once per
 * round), for a card that last acted in round `lastRound`. Uses the full-move
 * number, so extra turns and reloads never make it act twice.
 */
export function isNewRound(state: GameState, lastRound: number | undefined): boolean {
  return state.status === 'active' && state.flags.fullMoveNumber > 1 && lastRound !== state.flags.fullMoveNumber;
}
