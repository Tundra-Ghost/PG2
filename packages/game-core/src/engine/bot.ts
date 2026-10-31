import type { Color, GameState, Move } from './types';
import { chessEngine } from './ChessEngine';
import { getAbilityOptions, performAbility } from './abilities';
import { applyMoveInternal, buildMove, cloneState, getValidPromotionTypes } from './gameLoop';

/**
 * Chick Bot — depth-1 material evaluator.
 * Tries every legal move, picks the one that maximises material score for `color`.
 * Ties are broken randomly (Math.random — bot evaluation doesn't need PRNG determinism).
 */

const PIECE_VALUE: Record<string, number> = {
  king: 0, queen: 900, chancellor: 800, royal_guard: 250, rook: 500, bishop: 320, knight: 310, pigeon: 300, pawn: 100,
};

function materialScore(state: GameState, color: Color): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    const val = PIECE_VALUE[piece.type] ?? 0;
    score += piece.color === color ? val : -val;
  }
  return score;
}

/**
 * Every move and ability `color` may play here, with promotions set to the
 * best piece the modifiers allow and modifier constraints (Gerald, pacifist,
 * frozen, etc.) respected.
 */
export function listBotMoves(state: GameState, color: Color): Move[] {
  const moves: Move[] = [];
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    for (const to of chessEngine.getLegalMoves(state, piece.square)) {
      const move = buildMove(state, piece.square, to);
      move.playerColor = color;
      if (chessEngine.isPromotionMove(state, piece.square, to)) {
        const [best] = getValidPromotionTypes(state, piece.square, to);
        if (!best) continue;
        move.promotion = best;
      }
      if (chessEngine.validateMove(state, move).valid) moves.push(move);
    }
  }
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    for (const option of getAbilityOptions(state, piece.square)) {
      for (const to of option.targets) {
        moves.push({ from: piece.square, to, playerColor: color, ability: option.modifierId });
      }
    }
  }
  return moves;
}

export function getChickBotMove(state: GameState, color: Color): Move | null {
  let bestScore = -Infinity;
  const bestMoves: Move[] = [];

  for (const move of listBotMoves(state, color)) {
    // Use applyMoveInternal for eval — avoids firing hooks during search.
    // Active abilities (C cards) compete on the same material score.
    const sim = move.ability
      ? performAbility(cloneState(state), move).state
      : applyMoveInternal(cloneState(state), move);
    const score = materialScore(sim, color);

    if (score > bestScore) {
      bestScore = score;
      bestMoves.length = 0;
      bestMoves.push(move);
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  if (bestMoves.length === 0) return null;
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Pigeon Bot — TDD §07 medium tier. Alpha-beta search a few plies deep that
 * plays every candidate through the full rules, modifier hooks included, so
 * it sees lava burns, freezes and abilities the way the game resolves them.
 */

const MATE_SCORE = 100_000;
const DEFAULT_PIGEON_DEPTH = 3;
const DEFAULT_TIME_BUDGET_MS = 900;
/** Small nudges so quiet positions are not all equal: centre and pawn progress. */
const CENTRE_BONUS = 12;
const PAWN_STEP_BONUS = 6;

function positionalScore(state: GameState, color: Color): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;
    let bonus = 0;
    if (piece.type === 'knight' || piece.type === 'pigeon' || piece.type === 'bishop' || piece.type === 'pawn') {
      const centreDistance = Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5));
      bonus += Math.round((3.5 - centreDistance) * (CENTRE_BONUS / 3));
    }
    if (piece.type === 'pawn') {
      bonus += (piece.color === 'white' ? rank - 1 : 6 - rank) * PAWN_STEP_BONUS;
    }
    score += piece.color === color ? bonus : -bonus;
  }
  return score;
}

/** Score from `color`'s side. Mates closer to the root score higher. */
function evaluate(state: GameState, color: Color, ply: number): number {
  if (state.status === 'checkmate') {
    // The side to move is the side that was mated.
    return state.turn === color ? -MATE_SCORE + ply : MATE_SCORE - ply;
  }
  if (state.status !== 'active') return 0;
  return materialScore(state, color) + positionalScore(state, color);
}

/** Captures and abilities first, so alpha-beta cuts off sooner. */
function orderMoves(state: GameState, moves: Move[]): Move[] {
  const value = (move: Move) => {
    if (move.ability) return 50;
    const victim = state.pieces.get(move.to);
    return victim ? (PIECE_VALUE[victim.type] ?? 0) : move.promotion ? 800 : 0;
  };
  return [...moves].sort((a, b) => value(b) - value(a));
}

/** Thrown inside the search when the time budget runs out. */
class OutOfTime extends Error {}

function search(
  state: GameState,
  color: Color,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  deadline: number,
): number {
  if (Date.now() > deadline) throw new OutOfTime();
  if (depth === 0 || state.status !== 'active') return evaluate(state, color, ply);
  const moves = listBotMoves(state, state.turn);
  if (moves.length === 0) return evaluate(state, color, ply);

  // Turns can be skipped or taken over by modifiers, so whose turn it is
  // decides max or min, not the ply count.
  const maximizing = state.turn === color;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of orderMoves(state, moves)) {
    const score = search(chessEngine.applyMove(state, move), color, depth - 1, ply + 1, alpha, beta, deadline);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** The best root moves at one depth, all tied on score. */
function bestRootMoves(state: GameState, color: Color, moves: Move[], depth: number, deadline: number): Move[] {
  let bestScore = -Infinity;
  const best: Move[] = [];
  for (const move of moves) {
    // Each root move gets a window just under the best so equal moves tie and the pick varies.
    const score = search(chessEngine.applyMove(state, move), color, depth - 1, 1, bestScore - 1, Infinity, deadline);
    if (score > bestScore) {
      bestScore = score;
      best.length = 0;
      best.push(move);
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  return best;
}

export interface PigeonBotOptions {
  /** Plies to search. TDD §07 sets 3 for Pigeon. */
  depth?: number;
  /** Stop deepening after this long, so slow phones never freeze the table. */
  timeBudgetMs?: number;
  random?: () => number;
}

/**
 * Searches one ply, then two, up to `depth`, and keeps the deepest search
 * that finished inside the time budget. One ply always finishes.
 */
export function getPigeonBotMove(state: GameState, color: Color, options: PigeonBotOptions = {}): Move | null {
  const { depth = DEFAULT_PIGEON_DEPTH, timeBudgetMs = DEFAULT_TIME_BUDGET_MS, random = Math.random } = options;
  const moves = orderMoves(state, listBotMoves(state, color));
  if (moves.length === 0) return null;
  const deadline = Date.now() + timeBudgetMs;
  let best = bestRootMoves(state, color, moves, 1, Infinity);
  for (let d = 2; d <= depth; d++) {
    try {
      best = bestRootMoves(state, color, moves, d, deadline);
    } catch (error) {
      if (error instanceof OutOfTime) break;
      throw error;
    }
  }
  return best[Math.floor(random() * best.length)] ?? null;
}
