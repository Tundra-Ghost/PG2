import type { Barrier, Color, GameState, Square, TileState } from './types';
import { getLegalMovesForPiece } from './moveGenerator';
import { validateMove } from './moveValidator';

/**
 * Timed blocked squares: a Dirt Hut wall (MOD-C018) or a flock of birds
 * (MOD-A009). Like Gerald's statue (engine/statue.ts) a barrier is a void
 * square, so nothing can land on it or slide through it and it blocks lines
 * of check. Unlike the statue it goes away on its own.
 */
export type { Barrier };

export function getBarrier(state: GameState, sq: Square): Barrier | undefined {
  return state.tiles.get(sq)?.barrier;
}

export function getBarriers(state: GameState, kind?: Barrier['kind']): { square: Square; barrier: Barrier }[] {
  const result: { square: Square; barrier: Barrier }[] = [];
  for (const [square, tile] of state.tiles) {
    if (tile.barrier && (!kind || tile.barrier.kind === kind)) result.push({ square, barrier: tile.barrier });
  }
  return result;
}

/** An empty, real square a barrier may go on: no piece, not void, no Lava. */
export function canHoldBarrier(state: GameState, sq: Square): boolean {
  if (state.pieces.has(sq)) return false;
  const tile = state.tiles.get(sq);
  if (tile?.isVoid || tile?.storm) return false;
  return !(tile?.effects.some(e => e.type === 'lava') ?? false);
}

/** Puts a barrier on each square (mutates `next`). */
export function placeBarriers(next: GameState, squares: Square[], barrier: Barrier): void {
  for (const sq of squares) {
    const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
    next.tiles.set(sq, { ...tile, barrier, isVoid: true });
  }
}

/** True while something other than a barrier keeps this tile void. */
function otherVoid(tile: TileState): boolean {
  return tile.storm === 'active' || tile.statue === true || tile.isClosed === true;
}

/** Removes the barrier from `sq` (mutates `next`), keeping other tile flags. */
export function clearBarrier(next: GameState, sq: Square): void {
  const tile = next.tiles.get(sq);
  if (!tile?.barrier) return;
  const { barrier: _b, isVoid: _v, ...rest } = tile;
  const keep: TileState = otherVoid(tile) ? { ...rest, isVoid: true } : rest;
  const { square: _s, effects, ...flags } = keep;
  if (effects.length === 0 && !Object.values(flags).some(Boolean)) next.tiles.delete(sq);
  else next.tiles.set(sq, keep);
}

/**
 * Lifts every barrier of `kind` whose time is up (turnNumber reached).
 * Returns the squares freed, or none.
 */
export function liftExpiredBarriers(state: GameState, kind: Barrier['kind']): { state: GameState; lifted: Square[] } {
  const due = getBarriers(state, kind).filter(b => state.turnNumber >= b.barrier.until);
  if (due.length === 0) return { state, lifted: [] };
  const next = { ...state, tiles: new Map(state.tiles) };
  for (const { square } of due) clearBarrier(next, square);
  return { state: next, lifted: due.map(b => b.square) };
}

/** Squares the King of `color` may legally move to, as if it were its turn. */
function kingMoveCount(state: GameState, color: Color): number {
  const asTurn = state.turn === color ? state : { ...state, turn: color };
  let count = 0;
  for (const king of state.pieces.values()) {
    if (king.type !== 'king' || king.color !== color) continue;
    count += getLegalMovesForPiece(asTurn, king).filter(to =>
      validateMove(asTurn, { from: king.square, to, playerColor: color }).valid,
    ).length;
  }
  return count;
}

/**
 * True when putting barriers on `squares` would take away the last legal
 * move of either King (Dirt Hut and The Birds never do that).
 */
export function cutsOffAKing(state: GameState, squares: Square[]): boolean {
  const after = { ...state, tiles: new Map(state.tiles) };
  placeBarriers(after, squares, { kind: 'wall', until: Infinity });
  for (const color of ['white', 'black'] as const) {
    if (kingMoveCount(state, color) > 0 && kingMoveCount(after, color) === 0) return true;
  }
  return false;
}
