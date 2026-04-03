import { v4 as uuidv4 } from 'uuid';
import type { Color, GameState, Move, Piece, Square, ValidationResult } from './types';
import { getLegalMovesForPiece, isInCheck as isInCheckGen, isSquareAttacked } from './moveGenerator';
import { applyMove as applyMoveFull, applyMoveInternal, activateModifiers as activateModifiersGL, beginTurn as beginTurnGL, buildMove, cloneState, isCheckmate as isCheckmateGL, isPromotionMove, isStalemate as isStalemateGL } from './gameLoop';
import { validateMove } from './moveValidator';

export interface IChessEngine {
  getInitialState(): GameState;
  validateMove(state: GameState, move: Move): ValidationResult;
  applyMove(state: GameState, move: Move): GameState;
  getLegalMoves(state: GameState, square: Square): Square[];
  isInCheck(state: GameState, color: Color): boolean;
  isCheckmate(state: GameState, color: Color): boolean;
  isStalemate(state: GameState, color: Color): boolean;
  isPromotionMove(state: GameState, from: Square, to: Square): boolean;
  beginTurn(state: GameState): GameState;
  activateModifiers(state: GameState, ids: string[]): GameState;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function sq(file: typeof FILES[number], rank: typeof RANKS[number]): Square {
  return `${file}${rank}` as Square;
}

function makePiece(
  type: Piece['type'],
  color: Color,
  square: Square,
): Piece {
  return { id: uuidv4(), type, color, square, cooldowns: {} };
}

function buildInitialPieces(): Map<Square, Piece> {
  const pieces = new Map<Square, Piece>();

  const backRank: Piece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  for (let i = 0; i < 8; i++) {
    const file = FILES[i];
    // White back rank
    pieces.set(sq(file, '1'), makePiece(backRank[i], 'white', sq(file, '1')));
    // White pawns
    pieces.set(sq(file, '2'), makePiece('pawn', 'white', sq(file, '2')));
    // Black pawns
    pieces.set(sq(file, '7'), makePiece('pawn', 'black', sq(file, '7')));
    // Black back rank
    pieces.set(sq(file, '8'), makePiece(backRank[i], 'black', sq(file, '8')));
  }

  return pieces;
}

class ChessEngineImpl implements IChessEngine {
  getInitialState(): GameState {
    return {
      id: uuidv4(),
      pieces: buildInitialPieces(),
      tiles: new Map(),
      turn: 'white',
      turnNumber: 1,
      activeModifiers: [],
      modifierState: {},
      moveHistory: [],
      status: 'active',
      positionHistory: {},
      prngSeed: Date.now() | 0,
      prngState: Date.now() | 0,
      flags: {
        enPassantSquare: null,
        castlingRights: {
          white: { kingSide: true, queenSide: true },
          black: { kingSide: true, queenSide: true },
        },
        halfMoveClock: 0,
        fullMoveNumber: 1,
      },
      madnessMeter: 0,
      tempoTokens: { white: 0, black: 0 },
      mercTokens: { white: 0, black: 0 },
    };
  }

  validateMove(state: GameState, move: Move): ValidationResult {
    return validateMove(state, move);
  }

  applyMove(state: GameState, move: Move): GameState {
    return applyMoveFull(state, move);
  }

  /**
   * Returns all truly legal destination squares for the piece on `square`.
   * Filters pseudo-legal moves by simulating each and ensuring the king is not in check.
   * Also verifies castling intermediate-square safety.
   */
  getLegalMoves(state: GameState, square: Square): Square[] {
    const piece = state.pieces.get(square);
    if (!piece) return [];

    const pseudoLegal = getLegalMovesForPiece(state, piece);
    const legal: Square[] = [];

    for (const to of pseudoLegal) {
      const move = buildMove(state, square, to);

      // Extra castling safety: not in check, not through check
      if (move.isCastle) {
        const opponent: Color = piece.color === 'white' ? 'black' : 'white';
        if (isInCheckGen(state, piece.color)) continue;
        const homeRank = piece.color === 'white' ? 0 : 7;
        const passFile = move.isCastle === 'kingside' ? 5 : 3;
        const passSq = `${FILES[passFile]}${RANKS[homeRank]}` as Square;
        if (isSquareAttacked(state, passSq, opponent)) continue;
      }

      const simulated = applyMoveInternal(cloneState(state), move);
      if (!isInCheckGen(simulated, piece.color)) {
        legal.push(to);
      }
    }

    return legal;
  }

  isInCheck(state: GameState, color: Color): boolean {
    return isInCheckGen(state, color);
  }

  isCheckmate(state: GameState, color: Color): boolean {
    return isCheckmateGL(state, color);
  }

  isStalemate(state: GameState, color: Color): boolean {
    return isStalemateGL(state, color);
  }

  isPromotionMove(state: GameState, from: Square, to: Square): boolean {
    return isPromotionMove(state, from, to);
  }

  beginTurn(state: GameState): GameState {
    return beginTurnGL(state);
  }

  activateModifiers(state: GameState, ids: string[]): GameState {
    return activateModifiersGL(state, ids);
  }
}

export const chessEngine = new ChessEngineImpl();
