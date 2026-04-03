import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { prngPickIndex } from '../../engine/prng';
import { cloneState, applyMoveInternal, buildMove } from '../../engine/gameLoop';
import { getLegalMovesForPiece } from '../../engine/moveGenerator';

const ID = 'MOD-E006';

const PIECE_VALUE: Partial<Record<string, number>> = {
  queen: 900, rook: 500, bishop: 320, knight: 310, pawn: 100,
};

function findBerserker(state: GameState): Piece | undefined {
  for (const p of state.pieces.values()) {
    if (p.isBerserker) return p;
  }
  return undefined;
}

/** Find the highest-value capture available from a given square. */
function getBestCaptureTarget(state: GameState, from: Square): Square | null {
  const piece = state.pieces.get(from);
  if (!piece) return null;

  const moves = getLegalMovesForPiece(state, piece);
  let bestValue = -1;
  let bestTo: Square | null = null;

  for (const to of moves) {
    const target = state.pieces.get(to);
    if (!target || target.color === piece.color) continue;
    const val = PIECE_VALUE[target.type] ?? 0;
    if (val > bestValue) {
      bestValue = val;
      bestTo = to;
    }
  }
  return bestTo;
}

export const berserkerDef: ModifierDefinition = {
  id: ID,
  name: 'Berserker',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',

  onActivate(state) {
    // Designate a random non-king, non-pawn piece as the Berserker.
    const candidates = Array.from(state.pieces.values()).filter(
      p => p.type !== 'king' && p.type !== 'pawn',
    );
    if (candidates.length === 0) return state;

    const next = cloneState(state);
    const [idx, nextPrng] = prngPickIndex(state.prngState, candidates.length);
    next.prngState = nextPrng;

    const target = candidates[idx];
    const piece = next.pieces.get(target.square);
    if (piece) {
      next.pieces.set(target.square, { ...piece, isBerserker: true });
    }
    return next;
  },

  onCapture(state, move, _captured) {
    // After the berserker makes a capture, auto-execute one chain capture
    // if a target is available (uses applyMoveInternal to avoid recursion).
    const berserkerNow = state.pieces.get(move.to);
    if (!berserkerNow?.isBerserker) return state;

    const chainTo = getBestCaptureTarget(state, move.to);
    if (!chainTo) return state;

    const chainMove = buildMove(state, move.to, chainTo);
    return applyMoveInternal(state, chainMove);
  },

  // Ensure berserker flag survives promotion (if berserker pawn promotes)
  onPromotion(state, move) {
    const berserker = findBerserker(state);
    if (!berserker) return state;
    // The promoted piece is now at move.to
    const promoted = state.pieces.get(move.to);
    if (!promoted || promoted.id !== berserker.id) return state;
    const next = cloneState(state);
    next.pieces.set(move.to, { ...promoted, isBerserker: true });
    return next;
  },
};
