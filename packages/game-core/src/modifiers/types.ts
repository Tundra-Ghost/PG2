import type { Color, GameState, ModifierID, Move, Piece, PieceType, Square } from '../engine/types';

export interface PreMoveResult {
  blocked: boolean;
  reason?: string;
}

export interface PreMoveApplyResult {
  state: GameState;
  move: Move;
}

export interface AbilityResult {
  state: GameState;
  /** The piece removed by the ability, if any. Runs onCapture hooks. */
  captured?: Piece;
}

/**
 * An active ability (category C). The player selects a piece, presses the
 * ability button, then picks a target square. It is played as a Move with
 * `ability` set, costs the turn, and then cools down for that piece.
 */
export interface AbilitySpec {
  /** Short button label, such as "Rook move". */
  label: string;
  /** One line shown under the button. */
  hint: string;
  pieceTypes: PieceType[];
  /** Own turns the piece must wait after using it. */
  cooldown: number;
  /** Candidate target squares (self-check is filtered by the engine). */
  getTargets: (state: GameState, piece: Piece) => Square[];
  /** Physical effect. Default: the piece moves to the target like a normal move. */
  apply?: (state: GameState, move: Move) => AbilityResult;
  /** Move-list text. Default: piece letter, from, x or -, to. */
  notation?: (state: GameState, move: Move) => string;
  /** Pieces the player picks from for this target (sent as `move.dropType`). */
  getChoices?: (state: GameState, piece: Piece, to: Square) => PieceType[];
  /** Replaces "ready" on the button, such as a token count. */
  status?: (state: GameState, piece: Piece) => string;
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
  draftScope?: 'shared' | 'owned';
  ability?: AbilitySpec;

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

  /**
   * Called once the side to move is known and its turn has begun. Return a
   * move to play for that side instead of waiting for input (MOD-B001), with
   * the state it should be played from (PRNG advanced, events added).
   */
  takeOverTurn?: (state: GameState) => { state: GameState; move: Move } | null;

  /** Called when the match ends (checkmate, draw, abandon). */
  onMatchEnd?: (state: GameState) => void;

  /**
   * Fog-of-war: return the set of squares visible to `color`.
   * Return null to use default full visibility.
   */
  getVisibleSquares?: (state: GameState, color: Color) => Square[] | null;

  /**
   * Fog-of-war: squares shown to `color` even through fog. Added after every
   * fog card has limited the view.
   */
  getRevealedSquares?: (state: GameState, color: Color) => Square[];
}
