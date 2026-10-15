import type { GameState, Move, ValidationResult } from './types';
import { getLegalMovesForPiece, isInCheck, isSquareAttacked } from './moveGenerator';
import { applyMoveInternal, cloneState, runPreMoveApplyHooks } from './gameLoop';
import { modifierRegistry } from '../modifiers/registry';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function fileIndex(sq: string): number {
  return FILES.indexOf(sq[0] as typeof FILES[number]);
}

function rankIndex(sq: string): number {
  return RANKS.indexOf(sq[1] as typeof RANKS[number]);
}

function toSquare(f: number, r: number): string {
  return `${FILES[f]}${RANKS[r]}`;
}

function runPreMoveHooks(state: GameState, move: Move): { blocked: boolean; reason?: string } {
  for (const inst of state.activeModifiers) {
    const def = modifierRegistry.get(inst.id);
    if (def?.onPreMoveValidate) {
      const result = def.onPreMoveValidate(state, move);
      if (result.blocked) return result;
    }
  }
  return { blocked: false };
}

function checkTileEffects(_state: GameState, _move: Move): { blocked: boolean; reason?: string } {
  // TODO: Phase 1 — check lava, frozen, swamp, void tile states
  return { blocked: false };
}

export function validateMove(state: GameState, move: Move): ValidationResult {
  // ─── Stage 1: Structural validity ────────────────────────────────────────
  if (state.turn !== move.playerColor) {
    return { valid: false, reason: 'not your turn' };
  }
  if (state.status !== 'active') {
    return { valid: false, reason: 'game not active' };
  }
  const piece = state.pieces.get(move.from);
  if (!piece) {
    return { valid: false, reason: 'no piece at source' };
  }

  // ─── Stage 2: Piece ownership ─────────────────────────────────────────────
  if (piece.color !== move.playerColor) {
    return { valid: false, reason: 'not your piece' };
  }

  // ─── Stage 3: Pre-move modifier hooks (stub) ──────────────────────────────
  const hookResult = runPreMoveHooks(state, move);
  if (hookResult.blocked) {
    return { valid: false, reason: hookResult.reason ?? 'blocked by modifier' };
  }

  // ─── Stage 4: Piece movement rules ───────────────────────────────────────
  const pseudoLegal = getLegalMovesForPiece(state, piece);
  if (!pseudoLegal.includes(move.to)) {
    return { valid: false, reason: 'illegal move for piece type' };
  }

  // Extra castling checks: king must not be in check, must not pass through attacked square
  if (move.isCastle) {
    const opponent = piece.color === 'white' ? 'black' : 'white';
    if (isInCheck(state, piece.color)) {
      return { valid: false, reason: 'cannot castle while in check' };
    }
    const homeRank = piece.color === 'white' ? 0 : 7;
    const passThrough = move.isCastle === 'kingside'
      ? toSquare(5, homeRank)
      : toSquare(3, homeRank);
    if (isSquareAttacked(state, passThrough as import('./types').Square, opponent)) {
      return { valid: false, reason: 'cannot castle through check' };
    }
  }

  // ─── Stage 5: Tile effect checks (stub) ──────────────────────────────────
  const tileResult = checkTileEffects(state, move);
  if (tileResult.blocked) {
    return { valid: false, reason: tileResult.reason ?? 'blocked by tile effect' };
  }

  // ─── Stage 6: Self-check guard (NEVER stub) ───────────────────────────────
  // Simulate the move and verify the moving player's king is not in check
  const prepared = runPreMoveApplyHooks(state, move);
  const simulated = applyMoveInternal(cloneState(prepared.state), prepared.move);
  if (isInCheck(simulated, move.playerColor)) {
    return { valid: false, reason: 'leaves king in check' };
  }

  return { valid: true };
}
