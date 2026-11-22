import type { GameState, Piece, Square } from './types';

/**
 * Shared push and pull helpers: Get Off My Lawn (C017), YEET (C009),
 * GET OVER HERE! (C011) and the Gerald statue (A016) all move a piece or
 * tile one step along a line.
 */

/** The eight one-step directions: orthogonals first, then diagonals. */
export const ALL_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];
export const ORTHOGONAL_DIRECTIONS = ALL_DIRECTIONS.slice(0, 4);
export const DIAGONAL_DIRECTIONS = ALL_DIRECTIONS.slice(4);

/** The square `df` files and `dr` ranks away, or null off the board. */
export function offset(sq: Square, df: number, dr: number): Square | null {
  const f = sq.charCodeAt(0) - 97 + df;
  const r = Number(sq[1]) - 1 + dr;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}

export function isLavaSquare(state: GameState, sq: Square): boolean {
  return state.tiles.get(sq)?.effects.some(e => e.type === 'lava') ?? false;
}

/**
 * True if a pushed or pulled `piece` may land on `sq`: an empty, real square
 * (not void, storm or statue). A pawn never lands on rank 1 or 8, where it
 * could not stand. Lava is allowed only with `allowLava`.
 */
export function canMovePieceTo(
  state: GameState,
  piece: Piece,
  sq: Square | null,
  { allowLava = false }: { allowLava?: boolean } = {},
): sq is Square {
  // Void covers used vents, storm and the statue. Inlined so this file imports nothing.
  if (!sq || state.pieces.has(sq) || state.tiles.get(sq)?.isVoid) return false;
  if (piece.type === 'pawn' && (sq[1] === '1' || sq[1] === '8')) return false;
  return allowLava || !isLavaSquare(state, sq);
}

/** Moves the piece on `from` to `to` on `next` (mutates it). */
export function shiftPiece(next: GameState, from: Square, to: Square): void {
  const piece = next.pieces.get(from)!;
  next.pieces.delete(from);
  next.pieces.set(to, { ...piece, square: to });
}
