import type { Color, GameState, MoveRecord, Square } from './types';
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
  if (!visible || record.pieceMoved.color === viewer) return false;
  return !visible.has(record.move.to);
}
