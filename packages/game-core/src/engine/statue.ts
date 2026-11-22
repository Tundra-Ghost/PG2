import type { GameState, Piece, PieceType, Square } from './types';
import { ALL_DIRECTIONS, DIAGONAL_DIRECTIONS, ORTHOGONAL_DIRECTIONS, offset } from './push';

/**
 * MOD-A016 Monument To Gerald: a statue tile. It is also a void square, so
 * nothing can land on it or pass through it, and it blocks lines of check.
 * A piece next to it may push it one square the same way instead of moving.
 */

const ALL = ALL_DIRECTIONS;
const ORTHOGONAL = ORTHOGONAL_DIRECTIONS;
const DIAGONAL = DIAGONAL_DIRECTIONS;

/** Directions a piece may step into the statue. Leapers never push. */
function pushDirections(piece: Piece): ReadonlyArray<readonly [number, number]> {
  const kinds: Partial<Record<PieceType, ReadonlyArray<readonly [number, number]>>> = {
    king: ALL, queen: ALL, royal_guard: ALL, bodyguard: ALL,
    rook: ORTHOGONAL, chancellor: ORTHOGONAL, cannon: ORTHOGONAL,
    bishop: DIAGONAL, archbishop: DIAGONAL,
    pawn: [[0, piece.color === 'white' ? 1 : -1]],
  };
  return kinds[piece.type] ?? [];
}

export function isStatueSquare(state: GameState, sq: Square): boolean {
  return state.tiles.get(sq)?.statue === true;
}

export function getStatueSquare(state: GameState): Square | null {
  for (const [sq, tile] of state.tiles) if (tile.statue) return sq;
  return null;
}

/** The statue can only be pushed onto an empty, real square without Lava. */
function canHoldStatue(state: GameState, sq: Square | null): sq is Square {
  if (!sq || state.pieces.has(sq)) return false;
  const tile = state.tiles.get(sq);
  if (tile?.isVoid || tile?.storm) return false;
  return !(tile?.effects.some(e => e.type === 'lava') ?? false);
}

/** Where the statue on `to` goes when the piece on `from` pushes it, or null. */
export function statuePushTarget(state: GameState, from: Square, to: Square): Square | null {
  const piece = state.pieces.get(from);
  if (!piece || !isStatueSquare(state, to)) return null;
  for (const [df, dr] of pushDirections(piece)) {
    if (offset(from, df, dr) !== to) continue;
    const beyond = offset(to, df, dr);
    return canHoldStatue(state, beyond) ? beyond : null;
  }
  return null;
}

/** Statue squares the piece may push this move. */
export function statuePushMoves(state: GameState, piece: Piece): Square[] {
  const sq = getStatueSquare(state);
  return sq && statuePushTarget(state, piece.square, sq) ? [sq] : [];
}

/** Moves the statue tile from `to` to `beyond` on `next` (mutates it). */
export function moveStatue(next: GameState, to: Square, beyond: Square): void {
  const old = next.tiles.get(to)!;
  const { statue: _s, isVoid: _v, ...rest } = old;
  next.tiles.set(to, rest);
  const dest = next.tiles.get(beyond) ?? { square: beyond, effects: [] };
  next.tiles.set(beyond, { ...dest, statue: true, isVoid: true });
}
