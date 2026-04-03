import type { Color, GameState, Move } from './types';
import { chessEngine } from './ChessEngine';
import { applyMoveInternal, buildMove, cloneState } from './gameLoop';

/**
 * Chick Bot — depth-1 material evaluator.
 * Tries every legal move, picks the one that maximises material score for `color`.
 * Ties are broken randomly (Math.random — bot evaluation doesn't need PRNG determinism).
 */

const PIECE_VALUE: Record<string, number> = {
  king: 0, queen: 900, rook: 500, bishop: 320, knight: 310, pawn: 100,
};

function materialScore(state: GameState, color: Color): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    const val = PIECE_VALUE[piece.type] ?? 0;
    score += piece.color === color ? val : -val;
  }
  return score;
}

export function getChickBotMove(state: GameState, color: Color): Move | null {
  let bestScore = -Infinity;
  const bestMoves: Move[] = [];

  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    const legal = chessEngine.getLegalMoves(state, piece.square);

    for (const to of legal) {
      const move = buildMove(state, piece.square, to);

      // Auto-queen for promotions
      if (chessEngine.isPromotionMove(state, piece.square, to)) {
        move.promotion = 'queen';
      }

      // Respect modifier constraints (Gerald, pacifist, frozen, etc.)
      const validation = chessEngine.validateMove(state, move);
      if (!validation.valid) continue;

      // Use applyMoveInternal for eval — avoids firing hooks during search
      const sim = applyMoveInternal(cloneState(state), move);
      const score = materialScore(sim, color);

      if (score > bestScore) {
        bestScore = score;
        bestMoves.length = 0;
        bestMoves.push(move);
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
  }

  if (bestMoves.length === 0) return null;
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
