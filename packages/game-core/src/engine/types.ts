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
  | 'archbishop'   // MOD-E010 Holy Knight
  | 'elephant'     // MOD-E020 Elephant In The Room
  | 'camel'        // MOD-E011 Lawrence Of Arabia
  | 'nightrider'   // MOD-E019 Knight Rider
  | 'egg'          // MOD-E016 Hatchery: cannot move, hatches into a pigeon
  | 'cannon'       // MOD-E013 Overseas Hire: rook moves, captures over one screen
  | 'grasshopper'  // MOD-E012 Hopscotch: hops one piece along queen lines
  | 'bodyguard'    // MOD-E017 The Bodyguard: steps like a King, swaps with it
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
  isGhost?: boolean;     // MOD-D002: decoy, never captures or gives check
  isBerserker?: boolean; // future: MOD-E006
  isPacifist?: boolean;  // future: MOD-B007
  isRealKing?: boolean;  // future: MOD-E003
  isAmazon?: boolean;    // MOD-E009: a queen that also moves like a knight
  isTouched?: boolean;   // MOD-B015: touched this turn, so it must move
  isShielded?: boolean;  // MOD-C013: cannot be captured during the opponent's next move
  isDoubting?: boolean;  // MOD-B014: this Queen's next move is one square
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
  isClosed?: boolean;     // never part of the board: puzzle board shapes (also isVoid)
  isSwamp?: boolean;      // future: MOD-A006
  storm?: 'warning' | 'active'; // MOD-A005: warning before a wave, active once consumed (also isVoid)
  isSurveilled?: boolean; // future: MOD-D008
  noFlyZone?: Color;      // future: MOD-C001
  statue?: boolean;       // MOD-A016: Gerald's statue (also isVoid)
  barrier?: Barrier;      // MOD-C018 wall, MOD-A009 flock: timed, also isVoid
  flockWarning?: boolean; // MOD-A009: a flock lands here next round
  portal?: 'blue' | 'orange'; // MOD-A011: a fixed portal
  tide?: 'warning' | 'active'; // MOD-A017: water next round, or water now
  cropCircle?: 'warning' | 'active'; // MOD-A019: a crop circle next round, or now
  ice?: boolean;          // MOD-A012: sliders keep sliding
}

/**
 * A timed blocked square: a Dirt Hut wall (MOD-C018) or a flock of birds
 * (MOD-A009). See engine/barriers.ts.
 */
export interface Barrier {
  kind: 'wall' | 'flock';
  /** The side that built a wall. Flocks belong to nobody. */
  owner?: Color;
  /** The barrier lifts at the start of the turn with this turnNumber. */
  until: number;
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
  /** Board squares the event happened on, so the board can animate them. */
  squares?: Square[];
}

export interface MoveRecord {
  move: Move;
  pieceMoved: Piece;
  pieceCaptured?: Piece;
  notation: string;
  /** Online play: a move the receiving player may not see, sent as a blank (net/redact.ts). */
  hidden?: boolean;
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
  /**
   * Moves each side has made: piece moves, abilities, passes and skipped
   * turns, extra turns included. Unset until the first move; see ownMovesMade.
   */
  ownMoves?: Record<Color, number>;
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
  /** MOD-E008: the piece an ability places on the board (a Moneyball drop). */
  dropType?: PieceType;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  /** Hidden pieces: the move bumps into a piece its player cannot see (MOD-D009, MOD-D015). */
  bump?: boolean;
}
