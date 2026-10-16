import { chessEngine } from '../engine/ChessEngine';
import type { Color, GameState, Move, Piece, PieceType, Square } from '../engine/types';

export function makePiece(
  type: PieceType,
  color: Color,
  square: Square,
  id = `${color}-${type}-${square}`,
): Piece {
  return { id, type, color, square, cooldowns: {} };
}

/** An active position with only the given pieces, no castling rights, white to move. */
export function makeEmptyState(pieces: Piece[]): GameState {
  const state = chessEngine.getInitialState();
  state.pieces = new Map(pieces.map(piece => [piece.square, piece]));
  state.tiles = new Map();
  state.positionHistory = {};
  state.prngState = 1;
  state.flags.castlingRights = {
    white: { kingSide: false, queenSide: false },
    black: { kingSide: false, queenSide: false },
  };
  return state;
}

export function move(from: Square, to: Square, playerColor: Color, extras: Partial<Move> = {}): Move {
  return { from, to, playerColor, ...extras };
}
