import type { Color, GameState, Piece, Square } from './types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function fileIndex(sq: Square): number {
  return FILES.indexOf(sq[0] as typeof FILES[number]);
}

function rankIndex(sq: Square): number {
  return RANKS.indexOf(sq[1] as typeof RANKS[number]);
}

function toSquare(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${FILES[f]}${RANKS[r]}` as Square;
}

/** Pseudo-legal squares a sliding piece can reach (stops at blockers/captures). */
function slidingMoves(
  state: GameState,
  piece: Piece,
  directions: [number, number][],
): Square[] {
  const result: Square[] = [];
  const f = fileIndex(piece.square);
  const r = rankIndex(piece.square);
  for (const [df, dr] of directions) {
    let cf = f + df;
    let cr = r + dr;
    while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
      const sq = toSquare(cf, cr)!;
      const occupant = state.pieces.get(sq);
      if (occupant) {
        if (occupant.color !== piece.color) result.push(sq); // capture
        break; // blocked either way
      }
      result.push(sq);
      cf += df;
      cr += dr;
    }
  }
  return result;
}

function kingMoves(state: GameState, piece: Piece): Square[] {
  const result: Square[] = [];
  const f = fileIndex(piece.square);
  const r = rankIndex(piece.square);
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const sq = toSquare(f + df, r + dr);
      if (!sq) continue;
      const occupant = state.pieces.get(sq);
      if (!occupant || occupant.color !== piece.color) result.push(sq);
    }
  }

  // Castling — pseudo-legal (self-check and intermediate-check filtered in validateMove / getLegalMoves)
  const rights = state.flags.castlingRights[piece.color];
  const homeRank = piece.color === 'white' ? 0 : 7;
  if (r === homeRank && f === 4) {
    // Kingside
    if (rights.kingSide) {
      const f1 = toSquare(5, homeRank)!;
      const g1 = toSquare(6, homeRank)!;
      const h1 = toSquare(7, homeRank)!;
      const rookPresent = state.pieces.get(h1);
      if (
        rookPresent &&
        rookPresent.type === 'rook' &&
        rookPresent.color === piece.color &&
        !state.pieces.has(f1) &&
        !state.pieces.has(g1)
      ) {
        result.push(g1);
      }
    }
    // Queenside
    if (rights.queenSide) {
      const d1 = toSquare(3, homeRank)!;
      const c1 = toSquare(2, homeRank)!;
      const b1 = toSquare(1, homeRank)!;
      const a1 = toSquare(0, homeRank)!;
      const rookPresent = state.pieces.get(a1);
      if (
        rookPresent &&
        rookPresent.type === 'rook' &&
        rookPresent.color === piece.color &&
        !state.pieces.has(d1) &&
        !state.pieces.has(c1) &&
        !state.pieces.has(b1)
      ) {
        result.push(c1);
      }
    }
  }

  return result;
}

function knightMoves(state: GameState, piece: Piece): Square[] {
  const result: Square[] = [];
  const f = fileIndex(piece.square);
  const r = rankIndex(piece.square);
  const jumps: [number, number][] = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2],  [1, 2],  [2, -1], [2, 1],
  ];
  for (const [df, dr] of jumps) {
    const sq = toSquare(f + df, r + dr);
    if (!sq) continue;
    const occupant = state.pieces.get(sq);
    if (!occupant || occupant.color !== piece.color) result.push(sq);
  }
  return result;
}

function pawnMoves(state: GameState, piece: Piece): Square[] {
  const result: Square[] = [];
  const f = fileIndex(piece.square);
  const r = rankIndex(piece.square);
  const dir = piece.color === 'white' ? 1 : -1;
  const startRank = piece.color === 'white' ? 1 : 6;

  // Single push
  const oneAhead = toSquare(f, r + dir);
  if (oneAhead && !state.pieces.has(oneAhead)) {
    result.push(oneAhead);
    // Double push from starting rank
    if (r === startRank) {
      const twoAhead = toSquare(f, r + 2 * dir);
      if (twoAhead && !state.pieces.has(twoAhead)) {
        result.push(twoAhead);
      }
    }
  }

  // Diagonal captures
  for (const df of [-1, 1]) {
    const capSq = toSquare(f + df, r + dir);
    if (!capSq) continue;
    const occupant = state.pieces.get(capSq);
    if (occupant && occupant.color !== piece.color) {
      result.push(capSq);
    }
    // En passant
    if (capSq === state.flags.enPassantSquare) {
      result.push(capSq);
    }
  }

  return result;
}

/**
 * Returns pseudo-legal destination squares for a piece (does NOT filter self-check).
 * Used by moveValidator Stage 4 and checkmate/stalemate detection.
 */
export function getLegalMovesForPiece(state: GameState, piece: Piece): Square[] {
  switch (piece.type) {
    case 'king':
      return kingMoves(state, piece);
    case 'queen':
      return slidingMoves(state, piece, [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ]);
    case 'rook':
      return slidingMoves(state, piece, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    case 'bishop':
      return slidingMoves(state, piece, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    case 'knight':
      return knightMoves(state, piece);
    case 'pawn':
      return pawnMoves(state, piece);
    // Future piece types — no moves for now
    case 'pigeon':
    case 'chancellor':
    case 'royal_guard':
      return [];
  }
}

/**
 * Returns all squares attacked by a given color (for check detection).
 * Pawns attack diagonally even if no piece is there.
 */
export function getAttackSquares(state: GameState, color: Color): Set<Square> {
  const attacked = new Set<Square>();
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    if (piece.type === 'pawn') {
      const f = fileIndex(piece.square);
      const r = rankIndex(piece.square);
      const dir = piece.color === 'white' ? 1 : -1;
      for (const df of [-1, 1]) {
        const sq = toSquare(f + df, r + dir);
        if (sq) attacked.add(sq);
      }
    } else {
      // For king/queen/rook/bishop/knight — use their move squares as attacks
      // (excluding castling moves from attack coverage)
      const moves = getLegalMovesForPieceNocastle(state, piece);
      for (const sq of moves) attacked.add(sq);
    }
  }
  return attacked;
}

/** getLegalMovesForPiece without castling — used purely for attack-square calculation */
function getLegalMovesForPieceNocastle(state: GameState, piece: Piece): Square[] {
  if (piece.type === 'king') {
    const result: Square[] = [];
    const f = fileIndex(piece.square);
    const r = rankIndex(piece.square);
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const sq = toSquare(f + df, r + dr);
        if (!sq) continue;
        const occupant = state.pieces.get(sq);
        if (!occupant || occupant.color !== piece.color) result.push(sq);
      }
    }
    return result;
  }
  return getLegalMovesForPiece(state, piece);
}

/**
 * True if `sq` is attacked by any piece of `byColor`.
 */
export function isSquareAttacked(state: GameState, sq: Square, byColor: Color): boolean {
  return getAttackSquares(state, byColor).has(sq);
}

/**
 * True if `color`'s king is currently in check.
 */
export function isInCheck(state: GameState, color: Color): boolean {
  // Find king
  for (const piece of state.pieces.values()) {
    if (piece.color === color && piece.type === 'king') {
      return isSquareAttacked(state, piece.square, color === 'white' ? 'black' : 'white');
    }
  }
  return false; // no king found — should not happen in a valid game
}
