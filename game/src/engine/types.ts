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
  | 'chancellor'   // future: MOD-E004 Equivalent Exchange
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
  cooldowns: Record<ModifierID, number>;
  bannedEP?: Square;     // future: MOD-C008
}

export interface TileState {
  square: Square;
  effects: TileEffect[];
  isVent?: boolean;       // future: MOD-A003
  isSwamp?: boolean;      // future: MOD-A006
  isVoid?: boolean;       // future: MOD-A005
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

export interface MoveRecord {
  move: Move;
  pieceMoved: Piece;
  pieceCaptured?: Piece;
  notation: string;
}

export type DrawReason = 'stalemate' | '50-move' | 'threefold' | 'insufficient';

export interface GameState {
  id: string;
  pieces: Map<Square, Piece>;
  tiles: Map<Square, TileState>;
  turn: Color;
  turnNumber: number;
  activeModifiers: ModifierInstance[];
  modifierState: Record<ModifierID, unknown>;
  moveHistory: MoveRecord[];
  status: 'draft' | 'active' | 'checkmate' | 'draw' | 'abandoned';
  drawReason?: DrawReason;
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
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
