import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { canMovePieceTo, offset, shiftPiece } from '../../engine/push';
import { revealBumped, type Bumped } from '../../engine/conveyor';
import { getHiddenPieceIds } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.letItGo;

/** The central 4×4: c3 to f6. */
export const ICE_SQUARES: Square[] = [...'cdef'].flatMap(f => ['3', '4', '5', '6'].map(r => `${f}${r}` as Square));
const ICE = new Set<Square>(ICE_SQUARES);

export function isIceSquare(sq: Square): boolean {
  return ICE.has(sq);
}

const SLIDERS = new Set(['rook', 'bishop', 'queen']);

interface IceState {
  /** The piece making this move and whether it captured, set before the move. */
  mover?: string;
  captured?: boolean;
}

function side(color: string): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * MOD-A012: c3 to f6 is ice. A rook, bishop or queen whose normal move ends
 * on ice without capturing keeps sliding the same way, one square at a time,
 * until the next square is off the ice, not empty, or would leave its own
 * King in check. A capture stops the piece where it captured.
 * The slide is part of the move, so it may give check.
 */
export const letItGoDef: ModifierDefinition = {
  id: ID,
  name: 'Let It Go',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const next = cloneState(state);
    for (const sq of ICE_SQUARES) {
      const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
      next.tiles.set(sq, { ...tile, ice: true });
    }
    return next;
  },

  onPreMoveApply(state, move) {
    const mover = state.pieces.get(move.from);
    if (!mover) return { state, move };
    const captured = state.pieces.has(move.to) || !!move.isEnPassant;
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: { mover: mover.id, captured } satisfies IceState } }, move };
  },

  onPostMove(state, move) {
    const memo = state.modifierState[ID] as IceState | undefined;
    if (memo?.mover) state = { ...state, modifierState: { ...state.modifierState, [ID]: {} } };
    if (move.ability || move.isCastle || memo?.captured || !ICE.has(move.to)) return state;
    const piece = state.pieces.get(move.to);
    // Only the piece that made this move slides (another card may have moved it on).
    if (!piece || piece.id !== memo?.mover || !SLIDERS.has(piece.type)) return state;
    const df = Math.sign(move.to.charCodeAt(0) - move.from.charCodeAt(0));
    const dr = Math.sign(Number(move.to[1]) - Number(move.from[1]));
    if (df === 0 && dr === 0) return state;

    let next = cloneState(state);
    const bumped: Bumped = new Set();
    const enemy = piece.color === 'white' ? 'black' : 'white';
    let at = move.to;
    for (;;) {
      const to = offset(at, df, dr);
      if (!to || !ICE.has(to)) break;
      if (!canMovePieceTo(next, piece, to)) {
        // A hidden piece of either side stops the slide and is revealed, like a bump:
        // a slide stalled before an empty-looking square shows the opponent something is there.
        const blocker = next.pieces.get(to);
        if (blocker && getHiddenPieceIds(next, blocker.color === 'white' ? 'black' : 'white').has(blocker.id)) bumped.add(blocker.id);
        break;
      }
      const flags = next.flags;
      shiftPiece(next, at, to);
      if (isInCheck(next, piece.color)) {
        next.pieces.delete(to);
        next.pieces.set(at, { ...piece, square: at });
        next.flags = flags;
        break;
      }
      at = to;
    }
    next = revealBumped(next, bumped);
    if (at === move.to) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Ice',
      // Sus: name the piece as the opponent sees it.
      message: `${side(piece.color)}'s ${getShownType(state, piece, enemy)} slides on the ice to ${at}.`,
      // Both squares, so the event is blanked online while the slider is hidden (the text names where it went).
      squares: [move.to, at],
    });
  },
};
