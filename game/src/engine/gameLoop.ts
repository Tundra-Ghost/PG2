import { v4 as uuidv4 } from 'uuid';
import type { Color, GameState, Move, Piece, PieceType, Square } from './types';
import { getLegalMovesForPiece, isInCheck, isSquareAttacked } from './moveGenerator';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function fileIndex(sq: Square): number {
  return FILES.indexOf(sq[0] as typeof FILES[number]);
}

function rankIndex(sq: Square): number {
  return RANKS.indexOf(sq[1] as typeof RANKS[number]);
}

function toSquare(f: number, r: number): Square {
  return `${FILES[f]}${RANKS[r]}` as Square;
}

/** Deep clone a GameState, preserving Map structures. */
export function cloneState(state: GameState): GameState {
  const pieces = new Map<Square, Piece>();
  for (const [sq, piece] of state.pieces) {
    pieces.set(sq, { ...piece, cooldowns: { ...piece.cooldowns } });
  }
  const tiles = new Map(
    Array.from(state.tiles.entries()).map(([sq, tile]) => [
      sq,
      { ...tile, effects: tile.effects.map(e => ({ ...e })) },
    ]),
  );
  return {
    ...state,
    pieces,
    tiles,
    activeModifiers: [...state.activeModifiers],
    modifierState: { ...state.modifierState },
    moveHistory: [...state.moveHistory],
    flags: {
      ...state.flags,
      castlingRights: {
        white: { ...state.flags.castlingRights.white },
        black: { ...state.flags.castlingRights.black },
      },
    },
    tempoTokens: { ...state.tempoTokens },
    mercTokens: { ...state.mercTokens },
  };
}

/**
 * Determine if a move is castling (king moves 2 files) or en passant (pawn to EP square).
 * Auto-sets the relevant flags on the move object.
 */
export function buildMove(state: GameState, from: Square, to: Square): Move {
  const piece = state.pieces.get(from);
  const move: Move = { from, to, playerColor: state.turn };

  if (!piece) return move;

  if (piece.type === 'king') {
    const fileDiff = fileIndex(to) - fileIndex(from);
    if (fileDiff === 2) move.isCastle = 'kingside';
    if (fileDiff === -2) move.isCastle = 'queenside';
  }

  if (piece.type === 'pawn') {
    // En passant: diagonal move to an empty square
    if (to === state.flags.enPassantSquare) {
      move.isEnPassant = true;
    }
    // Promotion: pawn reaches back rank (handles both straight and diagonal capture)
    const toRank = rankIndex(to);
    if ((piece.color === 'white' && toRank === 7) || (piece.color === 'black' && toRank === 0)) {
      move.promotion = 'queen'; // Phase 0: auto-queen
    }
  }

  return move;
}

/**
 * Apply a move to a cloned state WITHOUT:
 *   - switching turns
 *   - checking game-end conditions
 *   - recording to history
 *
 * Used internally for check simulation. Call applyMove() for real moves.
 */
export function applyMoveInternal(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  const piece = next.pieces.get(move.from);
  if (!piece) return next;

  // Always reset en passant (will re-set below if this is a double pawn push)
  next.flags.enPassantSquare = null;

  // Half-move clock: reset on pawn moves or captures, else increment
  const isCapture = next.pieces.has(move.to) || move.isEnPassant === true;
  if (piece.type === 'pawn' || isCapture) {
    next.flags.halfMoveClock = 0;
  } else {
    next.flags.halfMoveClock++;
  }

  // --- Castling ---
  if (move.isCastle) {
    const homeRank = piece.color === 'white' ? 0 : 7;
    if (move.isCastle === 'kingside') {
      const rookFrom = toSquare(7, homeRank);
      const rookTo = toSquare(5, homeRank);
      const kingTo = toSquare(6, homeRank);
      const rook = next.pieces.get(rookFrom);
      next.pieces.delete(move.from);
      next.pieces.delete(rookFrom);
      if (rook) {
        next.pieces.set(rookTo, { ...rook, square: rookTo });
      }
      next.pieces.set(kingTo, { ...piece, square: kingTo });
    } else {
      const rookFrom = toSquare(0, homeRank);
      const rookTo = toSquare(3, homeRank);
      const kingTo = toSquare(2, homeRank);
      const rook = next.pieces.get(rookFrom);
      next.pieces.delete(move.from);
      next.pieces.delete(rookFrom);
      if (rook) {
        next.pieces.set(rookTo, { ...rook, square: rookTo });
      }
      next.pieces.set(kingTo, { ...piece, square: kingTo });
    }
    // Revoke all castling rights for this color
    next.flags.castlingRights[piece.color] = { kingSide: false, queenSide: false };
    return next;
  }

  // --- En passant capture ---
  if (move.isEnPassant) {
    const dir = piece.color === 'white' ? -1 : 1;
    const capturedPawnRank = rankIndex(move.to) + dir;
    const capturedPawnSq = toSquare(fileIndex(move.to), capturedPawnRank);
    next.pieces.delete(capturedPawnSq);
  }

  // --- Normal move / capture ---
  next.pieces.delete(move.from);
  next.pieces.delete(move.to); // remove any captured piece

  const promotedType: PieceType = move.promotion ?? piece.type;
  next.pieces.set(move.to, { ...piece, square: move.to, type: promotedType });

  // --- En passant square update (double pawn push) ---
  if (piece.type === 'pawn') {
    const rankDiff = Math.abs(rankIndex(move.to) - rankIndex(move.from));
    if (rankDiff === 2) {
      const epRank = (rankIndex(move.from) + rankIndex(move.to)) / 2;
      next.flags.enPassantSquare = toSquare(fileIndex(move.from), epRank);
    }
  }

  // --- Update castling rights ---
  // King moved
  if (piece.type === 'king') {
    next.flags.castlingRights[piece.color] = { kingSide: false, queenSide: false };
  }
  // Rook moved from starting square — revoke that side's right
  if (piece.type === 'rook') {
    const homeRank = piece.color === 'white' ? 0 : 7;
    if (rankIndex(move.from) === homeRank) {
      if (fileIndex(move.from) === 7) next.flags.castlingRights[piece.color].kingSide = false;
      if (fileIndex(move.from) === 0) next.flags.castlingRights[piece.color].queenSide = false;
    }
  }
  // Rook captured on its starting square — revoke opponent's right for that side
  if (isCapture && !move.isEnPassant) {
    const opponent: Color = piece.color === 'white' ? 'black' : 'white';
    const oppHomeRank = opponent === 'white' ? 0 : 7;
    if (rankIndex(move.to) === oppHomeRank) {
      if (fileIndex(move.to) === 7) next.flags.castlingRights[opponent].kingSide = false;
      if (fileIndex(move.to) === 0) next.flags.castlingRights[opponent].queenSide = false;
    }
  }

  return next;
}

/**
 * Returns true if `color` has at least one legal move in the current state.
 */
function hasAnyLegalMove(state: GameState, color: Color): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    const pseudoLegal = getLegalMovesForPiece(state, piece);
    for (const to of pseudoLegal) {
      const move = buildMove(state, piece.square, to);
      // For castling: also check king does not pass through check
      if (move.isCastle) {
        const homeRank = color === 'white' ? 0 : 7;
        const opponent: Color = color === 'white' ? 'black' : 'white';
        // King must not be in check on starting square
        if (isInCheck(state, color)) continue;
        // King must not pass through attacked intermediate square
        const passThrough = move.isCastle === 'kingside'
          ? toSquare(5, homeRank)
          : toSquare(3, homeRank);
        if (isSquareAttacked(state, passThrough, opponent)) continue;
      }
      const simulated = applyMoveInternal(state, move);
      if (!isInCheck(simulated, color)) return true;
    }
  }
  return false;
}

/** True if `color` is in checkmate. */
export function isCheckmate(state: GameState, color: Color): boolean {
  return isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

/** True if `color` is in stalemate. */
export function isStalemate(state: GameState, color: Color): boolean {
  return !isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

/**
 * Full move application: switches turn, increments counters, detects game end.
 * Returns the new GameState with status updated.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const pieceMoved = state.pieces.get(move.from)!;
  const pieceCaptured = move.isEnPassant
    ? (() => {
        const dir = pieceMoved.color === 'white' ? -1 : 1;
        const capRank = rankIndex(move.to) + dir;
        return state.pieces.get(toSquare(fileIndex(move.to), capRank));
      })()
    : state.pieces.get(move.to);

  let next = applyMoveInternal(state, move);

  // Switch turn
  const nextColor: Color = state.turn === 'white' ? 'black' : 'white';
  next.turn = nextColor;
  next.turnNumber = state.turnNumber + 1;

  // Full move number increments after black moves
  if (state.turn === 'black') {
    next.flags.fullMoveNumber = state.flags.fullMoveNumber + 1;
  }

  // Build notation (simplified algebraic)
  const notation = buildNotation(state, move, pieceCaptured !== undefined);

  // Record move
  next.moveHistory = [
    ...state.moveHistory,
    {
      move,
      pieceMoved,
      pieceCaptured,
      notation,
    },
  ];

  // Check game-end conditions for the player whose turn it now is
  if (isCheckmate(next, nextColor)) {
    next.status = 'checkmate';
  } else if (isStalemate(next, nextColor)) {
    next.status = 'draw';
  } else if (next.flags.halfMoveClock >= 100) {
    next.status = 'draw'; // 50-move rule
  }

  return next;
}

function buildNotation(state: GameState, move: Move, isCapture: boolean): string {
  if (move.isCastle === 'kingside') return 'O-O';
  if (move.isCastle === 'queenside') return 'O-O-O';
  const piece = state.pieces.get(move.from);
  if (!piece) return '?';
  const pieceSymbols: Partial<Record<string, string>> = {
    king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
  };
  const symbol = pieceSymbols[piece.type] ?? '';
  const capture = isCapture ? 'x' : '';
  const fromFile = piece.type === 'pawn' && isCapture ? move.from[0] : '';
  const promo = move.promotion ? `=${move.promotion[0].toUpperCase()}` : '';
  return `${symbol}${fromFile}${capture}${move.to}${promo}`;
}
