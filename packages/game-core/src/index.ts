/**
 * @pigeon-chess/game-core — public API.
 *
 * TDD §02: the chess engine and modifier state machine are pure TypeScript
 * with no framework dependencies. The server imports this package to own
 * all move validation. The web client imports it for types, rendering
 * helpers, and local (offline) play.
 *
 * Importing this module registers every shipped modifier definition.
 */
import './modifiers/index';

export * from './engine/types';
export { chessEngine } from './engine/ChessEngine';
export type { IChessEngine } from './engine/ChessEngine';
export {
  applyMoveInternal,
  buildMove,
  cloneState,
  getValidPromotionTypes,
  isPromotionMove,
  PROMOTION_TYPES,
} from './engine/gameLoop';
export { getChickBotMove, getPigeonBotMove } from './engine/bot';
export { getAbilityChoices, getAbilityOptions } from './engine/abilities';
export type { AbilityOption } from './engine/abilities';
export { drawByAgreement, getWinner, resign } from './engine/result';
export { prngPickIndex, prngStep } from './engine/prng';

export type { AbilityResult, AbilitySpec, ModifierDefinition, PreMoveApplyResult, PreMoveResult } from './modifiers/types';
export { ModifierRegistry, modifierRegistry } from './modifiers/registry';
export { MODIFIER_IDS } from './modifiers/ids';
export type { ModifierId } from './modifiers/ids';
export { getDraftScope, isSharedDraftModifier } from './modifiers/scope';
export type { DraftScope } from './modifiers/scope';
export * from './modifiers/data';
export { isFrozenZoneSquare } from './modifiers/definitions/winter';
export { getInfectedReach } from './modifiers/definitions/cordyceptic-spread';
export { getCrownOrders } from './modifiers/definitions/heavy-is-the-crown';
export { getFakeMoveHints } from './modifiers/definitions/recalculating';
export { isSwampSquare, SWAMP_SQUARES } from './modifiers/definitions/swamp';
export { getQuietZoneSquares } from './modifiers/definitions/quiet-quitting';
export { getBankedEnPassant } from './modifiers/definitions/banked-en-passant';
export { isHistoryBlackout, blackoutMovesLeft } from './modifiers/definitions/fifty-first-moves';
export { getNoFlySquares } from './modifiers/definitions/no-fly-zone';
export { MAX_TEMPO_TOKENS } from './modifiers/definitions/the-snap';

export {
  BUDGET,
  MAX_COUNT,
  MAX_PER_CATEGORY,
  getSelectedCards,
  getValidOptions,
  pickBlocker,
  pickRandomCard,
  runRandomDraft,
  type DraftRuleOptions,
} from './draft/rules';
export { createOnlineDraft, draftFinish, draftPick, isDraftComplete } from './draft/online';
export type { DraftResult, OnlineDraft } from './draft/online';

export { fromWire, toWire } from './net/wire';
export type { WireGameState } from './net/wire';
export { MAX_CHAT_CHARS } from './net/protocol';
export type {
  ActionAck,
  ChatMessage,
  ClientToServerEvents,
  CreateRoomRequest,
  DraftPickRequest,
  DrawOfferRequest,
  GameSummary,
  SeatRef,
  JoinRequest,
  MoveRequest,
  RoomAck,
  RoomSnapshot,
  SeatStatus,
  ServerToClientEvents,
} from './net/protocol';

export { MAX_DM_CHARS } from './net/social';
export type {
  DirectMessage,
  Friend,
  FriendList,
  FriendStatus,
  SocialAck,
  SocialClientEvents,
  SocialServerEvents,
} from './net/social';

export {
  ALL_SQUARES,
  MAX_PUZZLE_MOVES,
  PUZZLE_DIFFICULTIES,
  PUZZLE_PIECE_TYPES,
  buildPuzzleState,
  createEmptyPuzzle,
  decodePuzzle,
  describeGoal,
  encodePuzzle,
  getPuzzleProgress,
  validatePuzzle,
} from './puzzle/puzzle';
export type {
  Puzzle,
  PuzzleDifficulty,
  PuzzleGoal,
  PuzzleModifier,
  PuzzlePiece,
  PuzzleProgress,
  PuzzleStatus,
} from './puzzle/puzzle';
