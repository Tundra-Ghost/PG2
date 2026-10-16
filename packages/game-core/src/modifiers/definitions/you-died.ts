import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move } from '../../engine/types';
import { appendGameEvent, buildMove, getValidPromotionTypes, isPromotionMove } from '../../engine/gameLoop';
import { getLegalMovesForPiece } from '../../engine/moveGenerator';
import { validateMove } from '../../engine/moveValidator';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.youDied;
/** Every 7th turn of the owner is played by a piece on its own. */
export const YOU_DIED_INTERVAL = 7;

/** 1 for a side's first turn, 2 for its second, and so on. */
function ownTurnIndex(state: GameState): number {
  return Math.ceil(state.turnNumber / 2);
}

/** Every fully valid normal move for the side to move (no abilities). */
export function allValidMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (const piece of state.pieces.values()) {
    if (piece.color !== state.turn) continue;
    for (const to of getLegalMovesForPiece(state, piece)) {
      const move = buildMove(state, piece.square, to);
      if (isPromotionMove(state, piece.square, to)) {
        const [best] = getValidPromotionTypes(state, piece.square, to);
        if (!best) continue;
        move.promotion = best;
      }
      if (validateMove(state, move).valid) moves.push(move);
    }
  }
  return moves;
}

function label(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

export const youDiedDef: ModifierDefinition = {
  id: ID,
  name: 'YOU DIED (But A Piece Did)',
  category: 'B',
  pointCost: -3,
  curseRating: 3,
  activeFor: 'both',
  draftScope: 'owned',

  takeOverTurn(state) {
    if (!affectsColor(state, ID, state.turn)) return null;
    if (ownTurnIndex(state) % YOU_DIED_INTERVAL !== 0) return null;

    const moves = allValidMoves(state);
    if (moves.length === 0) return null;

    const [idx, prng] = prngPickIndex(state.prngState, moves.length);
    const move = moves[idx];
    const piece = state.pieces.get(move.from)!;
    const next = appendGameEvent({ ...state, prngState: prng }, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'A PIECE MOVED',
      message: `${label(state.turn)}'s ${piece.type} on ${move.from} decided to go to ${move.to}. Nobody asked it to.`,
    });
    return { state: next, move };
  },
};
