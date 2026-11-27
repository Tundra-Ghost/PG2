import type { Color, GameState, Square } from './types';
import { canMovePieceTo, shiftPiece } from './push';
import { pieceAttackSquares } from './moveGenerator';
import { getHiddenPieceIds } from './visibility';
import { revealHiddenPieces } from './gameLoop';
import { isSwampSquare } from '../modifiers/definitions/swamp';
import { getShownType } from '../modifiers/definitions/sus';

const SWAMP_ID = 'MOD-A006';

/**
 * Board-moving cards that shift pieces on their own at the end of a round:
 * The Factory Must Grow (A010), The Magic Roundabout (A013) and The Roomba
 * (A015). They share one rule set, built on the push helpers (engine/push.ts):
 * - A slide never captures. It needs an empty, real square (no wall, flock,
 *   statue, storm or Lava).
 * - A slide never puts a King in check: a King moves only to a safe square,
 *   and a piece shielding a King stays. A slide never adds a checker against
 *   a King that is already in check.
 * - A hidden piece (Invisibility Cloak, Camouflage) that blocks a slide is
 *   revealed, like a bump on a normal move.
 */
const COLORS: Color[] = ['white', 'black'];

/** How many enemy pieces attack `color`'s King (0 when it has none on the board). */
function checkers(state: GameState, color: Color): number {
  const king = [...state.pieces.values()].find(p => p.color === color && p.type === 'king');
  if (!king) return 0;
  let n = 0;
  for (const piece of state.pieces.values()) {
    if (piece.color !== color && pieceAttackSquares(state, piece).includes(king.square)) n++;
  }
  return n;
}

/**
 * Collects hidden pieces that blocked a slide, so the card can reveal them
 * once its slides are done (see revealBumped).
 */
export type Bumped = Set<string>;

/**
 * Slides the piece on `from` to `to` on `next` (mutates it) if the rules
 * above allow it. Returns true if it moved. A hidden blocker goes into `bumped`.
 */
export function slidePieceSafely(next: GameState, from: Square, to: Square | null, bumped?: Bumped): boolean {
  const piece = next.pieces.get(from);
  if (!piece) return false;
  // Sus: the pawn rank rule uses the type the opponent sees, so a slide never gives a disguise away.
  const shownType = getShownType(next, piece, piece.color === 'white' ? 'black' : 'white');
  if (!canMovePieceTo(next, piece, to, { shownType })) {
    const blocker = to ? next.pieces.get(to) : undefined;
    // Any hidden blocker, of either side: a stalled slide shows its opponent something is there.
    if (blocker && bumped && getHiddenPieceIds(next, blocker.color === 'white' ? 'black' : 'white').has(blocker.id)) bumped.add(blocker.id);
    return false;
  }
  const before = COLORS.map(color => checkers(next, color));
  const flags = next.flags;
  shiftPiece(next, from, to);
  const worse = COLORS.some((color, i) => {
    const after = checkers(next, color);
    return after > before[i] || (after > 0 && piece.type === 'king' && piece.color === color);
  });
  if (worse) {
    next.pieces.delete(to);
    next.pieces.set(from, piece);
    next.flags = flags;
    return false;
  }
  // A piece carried out of the Swamp (MOD-A006) is no longer stuck.
  const moved = next.pieces.get(to)!;
  if (moved.cooldowns[SWAMP_ID] && !isSwampSquare(to)) {
    const { [SWAMP_ID]: _stuck, ...cooldowns } = moved.cooldowns;
    next.pieces.set(to, { ...moved, cooldowns });
  }
  // Any pawn that slides ends en passant for this turn: the pawn that stepped
  // two squares may have moved, or another pawn may have slid next to it.
  if (piece.type === 'pawn' && next.flags.enPassantSquare) {
    next.flags = { ...next.flags, enPassantSquare: null };
  }
  return true;
}

/**
 * The squares an event may point at after slides: a hidden piece's new
 * square is left out, so the flash never shows where it went.
 */
export function shownSlideSquares(state: GameState, squares: Square[]): Square[] {
  return squares.filter(sq => {
    const piece = state.pieces.get(sq);
    if (!piece) return true;
    return !getHiddenPieceIds(state, piece.color === 'white' ? 'black' : 'white').has(piece.id);
  });
}

/** Reveals the hidden pieces that blocked a slide. */
export function revealBumped(state: GameState, bumped: Bumped): GameState {
  return bumped.size === 0 ? state : revealHiddenPieces(state, [...bumped], 'It blocks a moving piece.');
}

/**
 * True at the first turn start of a new round (after Black's move, once per
 * round), for a card that last acted in round `lastRound`. Uses the full-move
 * number, so extra turns and reloads never make it act twice.
 */
export function isNewRound(state: GameState, lastRound: number | undefined): boolean {
  return state.status === 'active' && state.flags.fullMoveNumber > 1 && lastRound !== state.flags.fullMoveNumber;
}
