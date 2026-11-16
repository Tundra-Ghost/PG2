import type { GameState, Piece, Square } from './types';

/**
 * Hopping over pieces, shared by the Cannon (MOD-E013), the Grasshopper
 * (MOD-E012) and Leap Of Faith (MOD-C010).
 *
 * A line runs from a square in one direction until the board edge or a void
 * square (vents, the Storm, the Statue). Void squares are off the board: a
 * piece can never hop over one, and one is never a screen.
 */

export const ORTHOGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const QUEEN_DIRS: ReadonlyArray<readonly [number, number]> = [...ORTHOGONAL_DIRS, ...DIAGONAL_DIRS];

function step(sq: Square, df: number, dr: number): Square | null {
  const f = sq.charCodeAt(0) - 97 + df;
  const r = Number(sq[1]) - 1 + dr;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}

/** The squares from `from` (not included) in one direction, up to the edge or a void square. */
export function lineSquares(state: GameState, from: Square, df: number, dr: number): Square[] {
  const result: Square[] = [];
  let sq = step(from, df, dr);
  while (sq && !state.tiles.get(sq)?.isVoid) {
    result.push(sq);
    sq = step(sq, df, dr);
  }
  return result;
}

/** The first piece on a line (the screen) and the squares behind it, or null if the line is empty. */
export function findScreen(
  state: GameState,
  from: Square,
  df: number,
  dr: number,
): { screen: Square; behind: Square[] } | null {
  const line = lineSquares(state, from, df, dr);
  const index = line.findIndex(sq => state.pieces.has(sq));
  if (index < 0) return null;
  return { screen: line[index], behind: line.slice(index + 1) };
}

/** The square right behind the first piece on a line, if there is one. */
export function hopLanding(state: GameState, from: Square, df: number, dr: number): Square | null {
  return findScreen(state, from, df, dr)?.behind[0] ?? null;
}

/**
 * Squares a Cannon threatens: past exactly one screen, every empty square up
 * to the next piece, and that piece if it is an enemy. A piece standing on
 * one of those empty squares could be taken, so they count for check and
 * castling.
 */
export function cannonAttacks(state: GameState, piece: Piece, enemiesOnly = false): Square[] {
  const result: Square[] = [];
  for (const [df, dr] of ORTHOGONAL_DIRS) {
    const found = findScreen(state, piece.square, df, dr);
    if (!found) continue;
    for (const sq of found.behind) {
      const occupant = state.pieces.get(sq);
      if (!occupant) {
        if (!enemiesOnly) result.push(sq);
        continue;
      }
      if (occupant.color !== piece.color) result.push(sq);
      break;
    }
  }
  return result;
}

/** Cannon moves: rook slides onto empty squares, and captures over exactly one screen. */
export function cannonMoves(state: GameState, piece: Piece): Square[] {
  const result: Square[] = [];
  for (const [df, dr] of ORTHOGONAL_DIRS) {
    for (const sq of lineSquares(state, piece.square, df, dr)) {
      if (state.pieces.has(sq)) break;
      result.push(sq);
    }
  }
  return [...result, ...cannonAttacks(state, piece, true)];
}
