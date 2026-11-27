import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Piece, Square } from '../../engine/types';
import { buildMove } from '../../engine/gameLoop';
import { chessEngine } from '../../engine/ChessEngine';
import { isInCheck } from '../../engine/moveGenerator';
import { getHiddenPieceIds, getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { modifierRegistry } from '../registry';

const ID = MODIFIER_IDS.spoilerAlert;

/** The piece each side marked to move next, by id. */
type SpoilerState = Partial<Record<Color, string>>;

function marks(state: GameState): SpoilerState {
  return (state.modifierState[ID] as SpoilerState | undefined) ?? {};
}

function inPlay(state: GameState): boolean {
  return state.activeModifiers.some(mod => mod.id === ID);
}

function findPiece(state: GameState, id: string | undefined): Piece | null {
  if (!id) return null;
  for (const piece of state.pieces.values()) if (piece.id === id) return piece;
  return null;
}

/** True when Spoiler Alert asks the player to mark a piece with this move. */
export function needsSpoilerMark(state: GameState, move: Move): boolean {
  if (!inPlay(state) || state.status !== 'active') return false;
  return !(move.ability && modifierRegistry.get(move.ability)?.ability?.free);
}

/**
 * The piece `color` must move this turn, or null when it is free: no mark,
 * the marked piece is gone, the side is in check (the mark is cancelled), or
 * the marked piece has no legal move.
 */
export function getSpoilerBinding(state: GameState, color: Color): Piece | null {
  if (!inPlay(state) || state.status !== 'active') return null;
  const piece = findPiece(state, marks(state)[color]);
  if (!piece || piece.color !== color || isInCheck(state, color)) return null;
  const free = { ...state, modifierState: { ...state.modifierState, [ID]: { ...marks(state), [color]: undefined } } };
  const canMove = chessEngine.getLegalMoves(state, piece.square).some(to =>
    chessEngine.validateMove(free, { ...buildMove(state, piece.square, to), playerColor: color }).valid,
  );
  return canMove ? piece : null;
}

/** Marked pieces `viewer` may see, with their side. */
export function getSpoilerMarks(state: GameState, viewer: Color | null): { square: Square; color: Color }[] {
  if (!inPlay(state) || state.status !== 'active') return [];
  const hidden = viewer ? getHiddenPieceIds(state, viewer) : new Set<string>();
  const visible = viewer ? getVisibleSquares(state, viewer) : null;
  const out: { square: Square; color: Color }[] = [];
  for (const color of ['white', 'black'] as const) {
    const piece = findPiece(state, marks(state)[color]);
    if (!piece || piece.color !== color || hidden.has(piece.id)) continue;
    if (viewer && piece.color !== viewer && visible && !visible.has(piece.square)) continue;
    out.push({ square: piece.square, color });
  }
  return out;
}

/**
 * MOD-D019: with each move a player marks the piece they will move next
 * (Move.spoiler, a piece id, so saved games and online moves carry it). Both
 * players see the mark. The next move must be that piece, unless the side is
 * in check or the piece has no legal move. A move sent without a mark (bots,
 * a takeover, a timeout) marks the piece that moved.
 */
export const spoilerAlertDef: ModifierDefinition = {
  id: ID,
  name: 'Spoiler Alert',
  category: 'D',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onPreMoveValidate(state, move) {
    if (!needsSpoilerMark(state, move)) return { blocked: false };
    if (move.spoiler !== undefined) {
      const marked = findPiece(state, move.spoiler);
      if (!marked || marked.color !== move.playerColor) return { blocked: true, reason: 'Spoiler Alert: mark one of your own pieces.' };
    }
    const bound = getSpoilerBinding(state, move.playerColor);
    if (bound && bound.square !== move.from) {
      return { blocked: true, reason: `Spoiler Alert: you said you would move your ${bound.type.replace('_', ' ')} on ${bound.square}.` };
    }
    return { blocked: false };
  },

  onPreMoveApply(state, move) {
    if (!needsSpoilerMark(state, move)) return { state, move };
    // Without a mark, the piece that moves is marked.
    const id = move.spoiler ?? state.pieces.get(move.from)?.id;
    if (!id) return { state, move };
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: { ...marks(state), [move.playerColor]: id } } }, move };
  },

  // Online: an enemy mark on a piece the viewer cannot see is left out.
  redactState(state, viewer) {
    const out: SpoilerState = {};
    const own = marks(state)[viewer];
    if (own) out[viewer] = own;
    const enemy: Color = viewer === 'white' ? 'black' : 'white';
    if (getSpoilerMarks(state, viewer).some(mark => mark.color === enemy)) out[enemy] = marks(state)[enemy];
    return out;
  },
};
