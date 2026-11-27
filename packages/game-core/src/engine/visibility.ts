import type { Color, GameState, MoveRecord, Piece, Square } from './types';
import { lineSquares } from './hops';
import { pieceAttackSquares } from './moveGenerator';
import { modifierRegistry } from '../modifiers/registry';

/**
 * Squares `viewer` can see, or null when no fog card is active. Each fog
 * card limits the view; with several, a square must pass all of them.
 * Squares holding the viewer's own pieces are always visible, and so are
 * squares a card reveals (getRevealedSquares).
 */
export function getVisibleSquares(state: GameState, viewer: Color): Set<Square> | null {
  const views: Set<Square>[] = [];
  const seen = new Set<string>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const squares = modifierRegistry.get(inst.id)?.getVisibleSquares?.(state, viewer);
    if (squares) views.push(new Set<Square>(squares));
  }
  if (views.length === 0) return null;
  const visible = new Set<Square>();
  for (const sq of views[0]) {
    if (views.every(view => view.has(sq))) visible.add(sq);
  }
  for (const piece of state.pieces.values()) {
    if (piece.color === viewer) visible.add(piece.square);
  }
  seen.clear();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    for (const sq of modifierRegistry.get(inst.id)?.getRevealedSquares?.(state, viewer) ?? []) visible.add(sq);
  }
  return visible;
}

/** True when `viewer` should not read this move: the opponent moved into fog. */
export function isMoveHidden(state: GameState, record: MoveRecord, viewer: Color, visible = getVisibleSquares(state, viewer)): boolean {
  if (record.pieceMoved.color === viewer) return false;
  if (isHiddenPieceMove(state, record, viewer)) return true;
  if (!visible) return false;
  return !visible.has(record.move.to);
}

// ─── Hidden pieces (MOD-D009 Invisibility Cloak, MOD-D015 Camouflage) ───────
// A hidden piece is on the board for the rules, but its opponent sees an
// empty square. Moves are offered to that opponent as if the square were
// empty. A move the hidden piece blocks is a "bump": it reveals the piece and
// does not use the move (see isBumpMove). Kings are never hidden (Core rule 1).

/** Ids of enemy pieces `viewer` cannot see. */
export function getHiddenPieceIds(state: GameState, viewer: Color): Set<string> {
  const ids = new Set<string>();
  // Once the game is over, everything is shown.
  if (state.status !== 'active') return ids;
  const seen = new Set<string>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    for (const id of modifierRegistry.get(inst.id)?.getHiddenPieces?.(state) ?? []) ids.add(id);
  }
  if (ids.size === 0) return ids;
  for (const piece of state.pieces.values()) {
    if (!ids.has(piece.id)) continue;
    if (piece.color === viewer || piece.type === 'king' || piece.isRealKing) ids.delete(piece.id);
  }
  // Ids of pieces no longer on the board are dropped too.
  const onBoard = new Set([...state.pieces.values()].map(piece => piece.id));
  for (const id of ids) if (!onBoard.has(id)) ids.delete(id);
  return ids;
}

/** True when `viewer` cannot see this enemy piece. */
export function isPieceHidden(state: GameState, piece: Piece, viewer: Color): boolean {
  return piece.color !== viewer && getHiddenPieceIds(state, viewer).has(piece.id);
}

/** True when the piece that made this move is hidden from `viewer` now. */
export function isHiddenPieceMove(state: GameState, record: MoveRecord, viewer: Color): boolean {
  if (record.pieceMoved.color === viewer) return false;
  const hidden = getHiddenPieceIds(state, viewer);
  return hidden.size > 0 && hidden.has(record.pieceMoved.id);
}

/**
 * The board as `viewer` believes it is: hidden enemy pieces taken off. Only
 * the piece map is copied. Returns `state` itself when nothing is hidden.
 */
export function withoutHiddenPieces(state: GameState, viewer: Color, hidden = getHiddenPieceIds(state, viewer)): GameState {
  if (hidden.size === 0) return state;
  const pieces = new Map(state.pieces);
  for (const [square, piece] of pieces) if (hidden.has(piece.id)) pieces.delete(square);
  return { ...state, pieces };
}

/** Ids of hidden pieces of `color` that attack an enemy King. A check always reveals. */
export function hiddenCheckers(state: GameState, color: Color): string[] {
  const viewer: Color = color === 'white' ? 'black' : 'white';
  const hidden = getHiddenPieceIds(state, viewer);
  if (hidden.size === 0) return [];
  const kings = [...state.pieces.values()].filter(piece => piece.color === viewer && piece.type === 'king').map(piece => piece.square);
  const result: string[] = [];
  for (const piece of state.pieces.values()) {
    if (!hidden.has(piece.id)) continue;
    if (pieceAttackSquares(state, piece).some(sq => kings.includes(sq))) result.push(piece.id);
  }
  return result;
}

/** Asks each hiding card to show these pieces again. No event is added. */
export function unhidePieces(state: GameState, pieceIds: string[]): GameState {
  if (pieceIds.length === 0) return state;
  let next = state;
  const seen = new Set<string>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const def = modifierRegistry.get(inst.id);
    if (def?.revealPieces) next = def.revealPieces(next, pieceIds);
  }
  return next;
}

/**
 * True when a hop from `from` to `to` (a Grasshopper move, or a Cannon move
 * past a screen) depends on a square the mover cannot see. Such a move dot
 * would give a hidden piece away, so it is not a legal move. Like Leap
 * Of Faith (MOD-C010), the whole path must be in view: the squares before
 * the screen, the screen and the landing square. Plain slides are not hops
 * and return false.
 */
export function isHopHidden(state: GameState, from: Square, to: Square, visible?: Set<Square> | null): boolean {
  const piece = state.pieces.get(from);
  if (!piece || (piece.type !== 'grasshopper' && piece.type !== 'cannon')) return false;
  const view = visible === undefined ? getVisibleSquares(state, piece.color) : visible;
  if (!view) return false;
  const df = Math.sign(to.charCodeAt(0) - from.charCodeAt(0));
  const dr = Math.sign(Number(to[1]) - Number(from[1]));
  const path: Square[] = [];
  for (const sq of lineSquares(state, from, df, dr)) {
    path.push(sq);
    if (sq === to) break;
  }
  if (path[path.length - 1] !== to) return false;
  const between = path.slice(0, -1);
  if (piece.type === 'cannon' && !between.some(sq => state.pieces.has(sq))) return false;
  return path.some(sq => !view.has(sq));
}
