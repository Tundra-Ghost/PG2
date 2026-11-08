import type { ModifierDefinition } from '../types';
import type { GameState, Move, Piece, Square } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, buildMove, cloneState, isPromotionMove } from '../../engine/gameLoop';
import { getLegalMovesForPiece, isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.bandersnatch;
const FILES = 'abcdefgh';

/** The square across the d/e axis on the same rank: c1 ↔ f1. */
export function mirrorSquare(square: Square): Square {
  return `${FILES[7 - FILES.indexOf(square[0])]}${square[1]}` as Square;
}

export function isBandersnatchActive(state: GameState): boolean {
  return state.activeModifiers.some(mod => mod.id === ID);
}

function label(piece: Piece): string {
  return `${piece.color} ${piece.type.replace('_', ' ')}`;
}

/**
 * MOD-A008: the board is split between the d and e files. When a piece
 * moves, its mirror twin (the own piece on the mirror of its start square)
 * makes the mirrored move, if that move is legal for it. Kings never move
 * or mirror. Abilities are not mirrored.
 */
export const bandersnatchDef: ModifierDefinition = {
  id: ID,
  name: 'Bandersnatch Protocol',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onPostMove(state, move) {
    if (move.ability || move.isCastle) return state;
    const mover = state.pieces.get(move.to);
    if (!mover || mover.type === 'king') return state;
    const from = mirrorSquare(move.from);
    const to = mirrorSquare(move.to);
    const twin = state.pieces.get(from);
    if (!twin || twin.id === mover.id || twin.color !== mover.color || twin.type === 'king') return state;
    if (!getLegalMovesForPiece(state, twin).includes(to)) return state;
    const mirrored: Move = buildMove(state, from, to);
    if (mirrored.isCastle) return state;
    if (isPromotionMove(state, from, to)) mirrored.promotion = 'queen';
    const captured = state.pieces.get(to);
    const after = applyMoveInternal(cloneState(state), mirrored);
    if (isInCheck(after, twin.color)) return state;
    const what = captured ? `takes the ${label(captured)} on ${to}` : `moves to ${to}`;
    return appendGameEvent(after, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Bandersnatch Protocol',
      squares: [from, to],
      message: `Every choice echoes. The ${label(twin)} on ${from} ${what}.`,
    });
  },
};
