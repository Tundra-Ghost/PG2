import type { Color, GameState, ModifierID, Move, Piece, Square } from '../engine/types';

export interface PreMoveResult {
  blocked: boolean;
  reason?: string;
}

export interface PreMoveApplyResult {
  state: GameState;
  move: Move;
}

/**
 * Full 9-hook modifier interface per TDD §4.2.
 * All hooks are optional — only implement what the modifier needs.
 *
 * Turn execution sequence:
 *   onTurnStart → (player input) → onPreMoveValidate → (engine validation)
 *   → onPreMoveApply → (board update) → onCapture → onPromotion
 *   → onPostMove → (check/game-end detection) → onTurnEnd → (emit)
 */
export interface ModifierDefinition {
  id: ModifierID;
  name: string;
  category: 'A' | 'B' | 'C' | 'D' | 'E';
  pointCost: number;       // negative = grants budget (curse)
  curseRating: 0 | 1 | 2 | 3;
  activeFor: Color | 'both';

  /** Called once when modifier is selected in the draft. */
  onActivate?: (state: GameState) => GameState;

  /** Called at the start of each turn (before player input). */
  onTurnStart?: (state: GameState) => GameState;

  /** Called during move validation — can block a move. */
  onPreMoveValidate?: (state: GameState, move: Move) => PreMoveResult;

  /** Called after validation, before board update — can mutate the move. */
  onPreMoveApply?: (state: GameState, move: Move) => PreMoveApplyResult;

  /** Called after a capture occurs (state is post-move). */
  onCapture?: (state: GameState, move: Move, captured: Piece) => GameState;

  /** Called after a promotion occurs (state is post-move). */
  onPromotion?: (state: GameState, move: Move) => GameState;

  /** Called after the move is applied to the board. */
  onPostMove?: (state: GameState, move: Move) => GameState;

  /** Called at the end of a turn, after game-end detection. */
  onTurnEnd?: (state: GameState) => GameState;

  /** Called when the match ends (checkmate, draw, abandon). */
  onMatchEnd?: (state: GameState) => void;

  /**
   * Fog-of-war: return the set of squares visible to `color`.
   * Return null to use default full visibility.
   */
  getVisibleSquares?: (state: GameState, color: Color) => Square[] | null;
}
