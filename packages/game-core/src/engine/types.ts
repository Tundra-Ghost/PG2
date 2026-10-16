type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export type PieceType =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn'
  | 'pigeon'       // future: MOD-E001 Hatoful Gambit
  | 'chancellor'   // MOD-E004 Equivalent Exchange
  | 'royal_guard'; // future: MOD-E003 Royal Guard

export type Color = 'white' | 'black';
export type ModifierID = string;
export type TileEffectType = 'lava' | 'infected' | 'frozen';

export interface TileEffect {
  type: TileEffectType;
  turnsRemaining: number;
}

export interface Piece {
  id: string;            // uuid — stable across modifier effects
  type: PieceType;
  color: Color;
  square: Square;
  isGhost?: boolean;     // future: MOD-D002
  isBerserker?: boolean; // future: MOD-E006
  isPacifist?: boolean;  // future: MOD-B007
  isRealKing?: boolean;  // future: MOD-E003
  isTraitor?: boolean;   // MOD-B006: warned, defects next turn
  hasPromotionChain?: boolean; // MOD-E007: chain-captures on its next capture
  cooldowns: Record<ModifierID, number>;
  /** Own turns left before each active ability (C cards) can be used again. */
  abilityCooldowns?: Record<ModifierID, number>;
  bannedEP?: Square;     // future: MOD-C008
}

export interface TileState {
  square: Square;
  effects: TileEffect[];
  isVent?: boolean;       // MOD-A003: hidden, unused vent
  isVoid?: boolean;       // off the board: used vent shafts, storm
  isSwamp?: boolean;      // future: MOD-A006
  isSurveilled?: boolean; // future: MOD-D008
  noFlyZone?: Color;      // future: MOD-C001
}

export interface CastlingRights {
  kingSide: boolean;
  queenSide: boolean;
}

export interface GameFlags {
  enPassantSquare: Square | null;
  castlingRights: Record<Color, CastlingRights>;
  halfMoveClock: number;
  fullMoveNumber: number;
}

export interface ModifierInstance {
  id: ModifierID;
  name: string;
  activeFor: Color | 'both';
  sourceColor?: Color | null;
}

export interface DraftModifierPick {
  id: ModifierID;
  sourceColor: Color | null;
}

export interface BerserkerChainEvent {
  counter: number;
  from: Square;
  to: Square;
  capturedType: PieceType | null;
}

export interface GameEvent {
  id: string;
  ply: number;
  type: 'modifier';
  modifierId: ModifierID;
  title: string;
  message: string;
}

export interface MoveRecord {
  move: Move;
  pieceMoved: Piece;
  pieceCaptured?: Piece;
  notation: string;
}

export type DrawReason = 'stalemate' | '50-move' | 'threefold' | 'insufficient' | 'agreement';

export interface GameState {
  id: string;
  pieces: Map<Square, Piece>;
  tiles: Map<Square, TileState>;
  turn: Color;
  turnNumber: number;
  activeModifiers: ModifierInstance[];
  modifierState: Record<ModifierID, unknown>;
  moveHistory: MoveRecord[];
  eventHistory: GameEvent[];
  status: 'draft' | 'active' | 'checkmate' | 'draw' | 'resigned' | 'abandoned';
  drawReason?: DrawReason;
  /** Set when status is 'resigned'. */
  resignedBy?: Color;
  flags: GameFlags;
  /** FEN-like position keys → occurrence count, used for threefold repetition. */
  positionHistory: Record<string, number>;
  /** Seeded PRNG — seed set at game start, state advances with every random draw. */
  prngSeed: number;
  prngState: number;
  madnessMeter: number;               // 0–100, reserved for modifier system
  tempoTokens: Record<Color, number>; // reserved: MOD-C007
  mercTokens: Record<Color, number>;  // reserved: MOD-E008
}

export interface Move {
  from: Square;
  to: Square;
  playerColor: Color;
  promotion?: PieceType;
  isCastle?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  /** Set when the move is an active ability (C cards) instead of a normal move. */
  ability?: ModifierID;
  /** MOD-C007: spend a tempo token so the same side moves again right after. */
  extraTurn?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
