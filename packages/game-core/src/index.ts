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
  isPromotionMove,
} from './engine/gameLoop';
export { getChickBotMove } from './engine/bot';
export { prngPickIndex, prngStep } from './engine/prng';

export type { ModifierDefinition, PreMoveApplyResult, PreMoveResult } from './modifiers/types';
export { ModifierRegistry, modifierRegistry } from './modifiers/registry';
export { MODIFIER_IDS } from './modifiers/ids';
export type { ModifierId } from './modifiers/ids';
export { getDraftScope, isSharedDraftModifier } from './modifiers/scope';
export type { DraftScope } from './modifiers/scope';
export * from './modifiers/data';
export { isFrozenZoneSquare } from './modifiers/definitions/winter';

export { fromWire, toWire } from './net/wire';
export type { WireGameState } from './net/wire';
export type {
  ActionAck,
  ClientToServerEvents,
  JoinRequest,
  MoveRequest,
  RoomAck,
  RoomSnapshot,
  SeatStatus,
  ServerToClientEvents,
} from './net/protocol';
