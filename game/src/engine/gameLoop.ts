import { v4 as uuidv4 } from 'uuid';
import type {
  Color,
  DrawReason,
  GameEvent,
  GameState,
  Move,
  Piece,
  PieceType,
  Square,
} from './types';
import { getLegalMovesForPiece, isInCheck, isSquareAttacked } from './moveGenerator';
import { modifierRegistry } from '../modifiers/registry';

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

// ─────────────────────────────────────────────────────────────────────────────
// Position hashing  (threefold-repetition detection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a deterministic key representing the full chess position.
 * Encodes: piece placement, side to move, castling rights, en-passant file.
 */
function positionKey(state: GameState): string {
  // 1. Piece placement — sorted so Map iteration order doesn't matter
  const pieceTokens: string[] = [];
  for (const [sq, p] of state.pieces) {
    const sym = p.type === 'knight' ? 'N' : p.type[0].toUpperCase();
    pieceTokens.push(`${sq}:${p.color[0]}${sym}`);
  }
  pieceTokens.sort();

  // 2. Side to move
  const sideToken = state.turn[0]; // 'w' | 'b'

  // 3. Castling rights
  const cr = state.flags.castlingRights;
  const castleToken = [
    cr.white.kingSide  ? 'K' : '',
    cr.white.queenSide ? 'Q' : '',
    cr.black.kingSide  ? 'k' : '',
    cr.black.queenSide ? 'q' : '',
  ].join('') || '-';

  // 4. En-passant file only (rank is implied by side-to-move)
  const epToken = state.flags.enPassantSquare
    ? state.flags.enPassantSquare[0]
    : '-';

  return `${pieceTokens.join(',')}|${sideToken}|${castleToken}|${epToken}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insufficient-material detection
// ─────────────────────────────────────────────────────────────────────────────

function isLightSquare(sq: Square): boolean {
  return (fileIndex(sq) + rankIndex(sq)) % 2 === 0;
}

function isInsufficientMaterial(state: GameState): boolean {
  const pieces = Array.from(state.pieces.values());

  // K vs K
  if (pieces.length === 2) return true;

  // K+B vs K  or  K+N vs K
  if (pieces.length === 3) {
    const minor = pieces.find(p => p.type === 'bishop' || p.type === 'knight');
    if (minor) return true;
  }

  // K+B vs K+B — both bishops on same square colour
  if (pieces.length === 4) {
    const bishops = pieces.filter(p => p.type === 'bishop');
    if (
      bishops.length === 2 &&
      bishops[0].color !== bishops[1].color &&
      isLightSquare(bishops[0].square) === isLightSquare(bishops[1].square)
    ) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep clone
// ─────────────────────────────────────────────────────────────────────────────

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
    eventHistory: [...state.eventHistory],
    positionHistory: { ...state.positionHistory },
    flags: {
      ...state.flags,
      castlingRights: {
        white: { ...state.flags.castlingRights.white },
        black: { ...state.flags.castlingRights.black },
      },
    },
    tempoTokens: { ...state.tempoTokens },
    mercTokens: { ...state.mercTokens },
    // PRNG state is shallow-copied — it's just a number
    prngSeed: state.prngSeed,
    prngState: state.prngState,
  };
}

export function appendGameEvent(
  state: GameState,
  event: Omit<GameEvent, 'id'>,
): GameState {
  const next = cloneState(state);
  next.eventHistory = [
    ...next.eventHistory,
    {
      ...event,
      id: uuidv4(),
    },
  ];
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMove
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if a move is castling or en passant and auto-set those flags.
 * Does NOT auto-set promotion — Board component handles that via PromotionModal.
 */
export function buildMove(state: GameState, from: Square, to: Square): Move {
  const piece = state.pieces.get(from);
  const move: Move = { from, to, playerColor: state.turn };

  if (!piece) return move;

  if (piece.type === 'king') {
    const fileDiff = fileIndex(to) - fileIndex(from);
    if (fileDiff === 2)  move.isCastle = 'kingside';
    if (fileDiff === -2) move.isCastle = 'queenside';
  }

  if (piece.type === 'pawn') {
    if (to === state.flags.enPassantSquare) {
      move.isEnPassant = true;
    }
    // Promotion flag — caller (Board) is responsible for setting move.promotion
    // before passing to validateMove/applyMove.
  }

  return move;
}

/**
 * Returns true if a pawn move from `from` to `to` reaches the back rank
 * and therefore requires a promotion choice from the player.
 */
export function isPromotionMove(state: GameState, from: Square, to: Square): boolean {
  const piece = state.pieces.get(from);
  if (!piece || piece.type !== 'pawn') return false;
  const toRank = rankIndex(to);
  return (piece.color === 'white' && toRank === 7) ||
         (piece.color === 'black' && toRank === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// applyMoveInternal  (simulation only — no turn switch / history)
// ─────────────────────────────────────────────────────────────────────────────

export function applyMoveInternal(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  const piece = next.pieces.get(move.from);
  if (!piece) return next;

  next.flags.enPassantSquare = null;

  const isCapture = next.pieces.has(move.to) || move.isEnPassant === true;
  if (piece.type === 'pawn' || isCapture) {
    next.flags.halfMoveClock = 0;
  } else {
    next.flags.halfMoveClock++;
  }

  // Castling
  if (move.isCastle) {
    const homeRank = piece.color === 'white' ? 0 : 7;
    if (move.isCastle === 'kingside') {
      const rookFrom = toSquare(7, homeRank);
      const rookTo   = toSquare(5, homeRank);
      const kingTo   = toSquare(6, homeRank);
      const rook = next.pieces.get(rookFrom);
      next.pieces.delete(move.from);
      next.pieces.delete(rookFrom);
      if (rook) next.pieces.set(rookTo, { ...rook, square: rookTo });
      next.pieces.set(kingTo, { ...piece, square: kingTo });
    } else {
      const rookFrom = toSquare(0, homeRank);
      const rookTo   = toSquare(3, homeRank);
      const kingTo   = toSquare(2, homeRank);
      const rook = next.pieces.get(rookFrom);
      next.pieces.delete(move.from);
      next.pieces.delete(rookFrom);
      if (rook) next.pieces.set(rookTo, { ...rook, square: rookTo });
      next.pieces.set(kingTo, { ...piece, square: kingTo });
    }
    next.flags.castlingRights[piece.color] = { kingSide: false, queenSide: false };
    return next;
  }

  // En passant capture
  if (move.isEnPassant) {
    const dir = piece.color === 'white' ? -1 : 1;
    const capturedPawnSq = toSquare(fileIndex(move.to), rankIndex(move.to) + dir);
    next.pieces.delete(capturedPawnSq);
  }

  // Normal move / capture
  next.pieces.delete(move.from);
  next.pieces.delete(move.to);
  const promotedType: PieceType = move.promotion ?? piece.type;
  next.pieces.set(move.to, { ...piece, square: move.to, type: promotedType });

  // Double-pawn-push → set en passant square
  if (piece.type === 'pawn') {
    const rankDiff = Math.abs(rankIndex(move.to) - rankIndex(move.from));
    if (rankDiff === 2) {
      const epRank = (rankIndex(move.from) + rankIndex(move.to)) / 2;
      next.flags.enPassantSquare = toSquare(fileIndex(move.from), epRank);
    }
  }

  // Update castling rights
  if (piece.type === 'king') {
    next.flags.castlingRights[piece.color] = { kingSide: false, queenSide: false };
  }
  if (piece.type === 'rook') {
    const homeRank = piece.color === 'white' ? 0 : 7;
    if (rankIndex(move.from) === homeRank) {
      if (fileIndex(move.from) === 7) next.flags.castlingRights[piece.color].kingSide  = false;
      if (fileIndex(move.from) === 0) next.flags.castlingRights[piece.color].queenSide = false;
    }
  }
  if (isCapture && !move.isEnPassant) {
    const opponent: Color = piece.color === 'white' ? 'black' : 'white';
    const oppHomeRank = opponent === 'white' ? 0 : 7;
    if (rankIndex(move.to) === oppHomeRank) {
      if (fileIndex(move.to) === 7) next.flags.castlingRights[opponent].kingSide  = false;
      if (fileIndex(move.to) === 0) next.flags.castlingRights[opponent].queenSide = false;
    }
  }

  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkmate / stalemate
// ─────────────────────────────────────────────────────────────────────────────

function hasAnyLegalMove(state: GameState, color: Color): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    const pseudoLegal = getLegalMovesForPiece(state, piece);
    for (const to of pseudoLegal) {
      const move = buildMove(state, piece.square, to);
      if (move.isCastle) {
        const homeRank = color === 'white' ? 0 : 7;
        const opponent: Color = color === 'white' ? 'black' : 'white';
        if (isInCheck(state, color)) continue;
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

export function isCheckmate(state: GameState, color: Color): boolean {
  return isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

export function isStalemate(state: GameState, color: Color): boolean {
  return !isInCheck(state, color) && !hasAnyLegalMove(state, color);
}

// ─────────────────────────────────────────────────────────────────────────────
// Algebraic notation
// ─────────────────────────────────────────────────────────────────────────────

/** Standard piece letter. Pawn = ''. Knight = 'N' (NOT 'K'). */
const PIECE_SYM: Partial<Record<PieceType, string>> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
};

/** Promotion suffix letter. */
const PROMO_SYM: Partial<Record<PieceType, string>> = {
  queen: 'Q', rook: 'R', bishop: 'B', knight: 'N',
};

/**
 * Builds standard algebraic notation for a move.
 * Requires the state BEFORE the move and the state AFTER (for +/# suffix).
 */
function buildNotation(
  stateBefore: GameState,
  move: Move,
  isCapture: boolean,
  stateAfter: GameState,
): string {
  if (move.isCastle === 'kingside')  return 'O-O';
  if (move.isCastle === 'queenside') return 'O-O-O';

  const piece = stateBefore.pieces.get(move.from);
  if (!piece) return '?';

  const sym = PIECE_SYM[piece.type] ?? '';

  // ── Disambiguation ──────────────────────────────────────────────────────────
  // Find sibling pieces of the same type/color that also have `move.to` in their
  // pseudo-legal moves (we use pseudo-legal here — a fully legal check would be
  // more correct but is expensive; in practice pseudo-legal is good enough for SAN).
  let disambig = '';
  if (piece.type !== 'pawn' && piece.type !== 'king') {
    const siblings = Array.from(stateBefore.pieces.values()).filter(
      p =>
        p.id !== piece.id &&
        p.type === piece.type &&
        p.color === piece.color &&
        getLegalMovesForPiece(stateBefore, p).includes(move.to),
    );
    if (siblings.length > 0) {
      const sameFile = siblings.some(p => p.square[0] === move.from[0]);
      const sameRank = siblings.some(p => p.square[1] === move.from[1]);
      if (!sameFile)        disambig = move.from[0];         // file suffices
      else if (!sameRank)   disambig = move.from[1];         // rank suffices
      else                  disambig = move.from;            // need both
    }
  }

  // Pawn captures always include from-file
  const pawnFile = piece.type === 'pawn' && isCapture ? move.from[0] : '';

  const captureStr = isCapture ? 'x' : '';
  const promoStr   = move.promotion ? `=${PROMO_SYM[move.promotion] ?? '?'}` : '';

  // Check / checkmate suffix
  const opponent: Color = piece.color === 'white' ? 'black' : 'white';
  let suffix = '';
  if (stateAfter.status === 'checkmate') {
    suffix = '#';
  } else if (isInCheck(stateAfter, opponent)) {
    suffix = '+';
  }

  return `${sym}${disambig}${pawnFile}${captureStr}${move.to}${promoStr}${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyMove  (full — switches turn, detects game end, records history)
// ─────────────────────────────────────────────────────────────────────────────

export function applyMove(state: GameState, move: Move): GameState {
  const pieceMoved = state.pieces.get(move.from)!;

  // Capture lookup (before the move is applied)
  const pieceCaptured = move.isEnPassant
    ? (() => {
        const dir = pieceMoved.color === 'white' ? -1 : 1;
        const capRank = rankIndex(move.to) + dir;
        return state.pieces.get(toSquare(fileIndex(move.to), capRank));
      })()
    : state.pieces.get(move.to);

  // Apply physical move
  let next = applyMoveInternal(state, move);

  // ── Modifier hooks: onCapture ───────────────────────────────────────────────
  const isCapture = pieceCaptured !== undefined;
  if (isCapture) {
    for (const inst of state.activeModifiers) {
      const def = modifierRegistry.get(inst.id);
      if (def?.onCapture) {
        next = def.onCapture(next, move, pieceCaptured!);
      }
    }
  }

  // ── Modifier hooks: onPromotion ─────────────────────────────────────────────
  if (move.promotion) {
    for (const inst of state.activeModifiers) {
      const def = modifierRegistry.get(inst.id);
      if (def?.onPromotion) {
        next = def.onPromotion(next, move);
      }
    }
  }

  // ── Modifier hooks: onPostMove ──────────────────────────────────────────────
  for (const inst of state.activeModifiers) {
    const def = modifierRegistry.get(inst.id);
    if (def?.onPostMove) {
      next = def.onPostMove(next, move);
    }
  }

  // Switch turn & counters
  const nextColor: Color = state.turn === 'white' ? 'black' : 'white';
  next.turn = nextColor;
  next.turnNumber = state.turnNumber + 1;
  if (state.turn === 'black') {
    next.flags.fullMoveNumber = state.flags.fullMoveNumber + 1;
  }

  // ── Position history (threefold-repetition) ─────────────────────────────────
  const key = positionKey(next);
  const posCount = (state.positionHistory[key] ?? 0) + 1;
  next.positionHistory = { ...state.positionHistory, [key]: posCount };

  // ── Game-end detection ──────────────────────────────────────────────────────
  let drawReason: DrawReason | undefined;

  if (isCheckmate(next, nextColor)) {
    next.status = 'checkmate';
  } else if (isStalemate(next, nextColor)) {
    next.status = 'draw';
    drawReason = 'stalemate';
  } else if (next.flags.halfMoveClock >= 100) {
    next.status = 'draw';
    drawReason = '50-move';
  } else if (posCount >= 3) {
    next.status = 'draw';
    drawReason = 'threefold';
  } else if (isInsufficientMaterial(next)) {
    next.status = 'draw';
    drawReason = 'insufficient';
  }
  if (drawReason) next.drawReason = drawReason;

  // ── Modifier hooks: onTurnEnd (player who just moved) ──────────────────────
  for (const inst of state.activeModifiers) {
    const def = modifierRegistry.get(inst.id);
    if (def?.onTurnEnd) {
      next = def.onTurnEnd(next);
    }
  }

  // ── Modifier hooks: onTurnStart (next player) — only if game still active ──
  if (next.status === 'active') {
    next = beginTurn(next);
  }

  // ── Build notation AFTER result state is known (check/# suffix) ─────────────
  const notation = buildNotation(state, move, isCapture, next);

  // Record move
  next.moveHistory = [
    ...state.moveHistory,
    { move, pieceMoved, pieceCaptured, notation },
  ];

  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// beginTurn  (fires onTurnStart for current player — call before player input)
// ─────────────────────────────────────────────────────────────────────────────

export function beginTurn(state: GameState): GameState {
  let next = cloneState(state);
  for (const inst of state.activeModifiers) {
    const def = modifierRegistry.get(inst.id);
    if (def?.onTurnStart) {
      next = def.onTurnStart(next);
    }
  }
  return next;
}

export function passTurn(state: GameState): GameState {
  let next = cloneState(state);

  const nextColor: Color = state.turn === 'white' ? 'black' : 'white';
  next.turn = nextColor;
  next.turnNumber = state.turnNumber + 1;
  next.flags.enPassantSquare = null;
  next.flags.halfMoveClock = state.flags.halfMoveClock + 1;

  if (state.turn === 'black') {
    next.flags.fullMoveNumber = state.flags.fullMoveNumber + 1;
  }

  const key = positionKey(next);
  const posCount = (state.positionHistory[key] ?? 0) + 1;
  next.positionHistory = { ...state.positionHistory, [key]: posCount };

  let drawReason: DrawReason | undefined;
  if (isStalemate(next, nextColor)) {
    next.status = 'draw';
    drawReason = 'stalemate';
  } else if (next.flags.halfMoveClock >= 100) {
    next.status = 'draw';
    drawReason = '50-move';
  } else if (posCount >= 3) {
    next.status = 'draw';
    drawReason = 'threefold';
  } else if (isInsufficientMaterial(next)) {
    next.status = 'draw';
    drawReason = 'insufficient';
  }
  if (drawReason) next.drawReason = drawReason;

  for (const inst of state.activeModifiers) {
    const def = modifierRegistry.get(inst.id);
    if (def?.onTurnEnd) {
      next = def.onTurnEnd(next);
    }
  }

  if (next.status === 'active') {
    next = beginTurn(next);
  }

  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// activateModifiers  (call after draft, before first beginTurn)
// ─────────────────────────────────────────────────────────────────────────────

export function activateModifiers(state: GameState, ids: string[]): GameState {
  let next = cloneState(state);
  for (const id of ids) {
    const def = modifierRegistry.get(id);
    if (!def) continue;
    next.activeModifiers = [
      ...next.activeModifiers,
      {
        id: def.id,
        name: def.name,
        activeFor: def.activeFor,
        sourceColor: def.activeFor === 'both' ? null : def.activeFor,
      },
    ];
    if (def.onActivate) {
      next = def.onActivate(next);
    }
  }
  return next;
}
