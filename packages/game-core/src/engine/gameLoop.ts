import { v4 as uuidv4 } from 'uuid';
import { getStatueSquare, moveStatue, statuePushTarget } from './statue';
import type {
  Color,
  DraftModifierPick,
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
import type { ModifierDefinition } from '../modifiers/types';
import { getDraftScope } from '../modifiers/scope';
import { MODIFIER_IDS } from '../modifiers/ids';
import { validateMove } from './moveValidator';
import { getHiddenPieceIds, hiddenCheckers, unhidePieces, withoutHiddenPieces } from './visibility';
import { ownMovesMade } from './ownMoves';
import { buildAbilityNotation, getAbilityOptions, performAbility, startAbilityCooldown, tickAbilityCooldowns } from './abilities';

const GERALD_ID = MODIFIER_IDS.gerald;

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

/** Position-key letters where the first letter of the type would collide. */
const POSITION_SYM: Partial<Record<PieceType, string>> = {
  knight: 'N', pigeon: 'H', royal_guard: 'G', elephant: 'El', camel: 'Cm', nightrider: 'Nr', egg: 'Eg', cannon: 'Cn', grasshopper: 'Gh', bodyguard: 'Bg',
};

/**
 * Produces a deterministic key representing the full chess position.
 * Encodes: piece placement, side to move, castling rights, en-passant file.
 */
export function positionKey(state: GameState): string {
  // 1. Piece placement — sorted so Map iteration order doesn't matter
  const pieceTokens: string[] = [];
  for (const [sq, p] of state.pieces) {
    let sym = POSITION_SYM[p.type] ?? p.type[0].toUpperCase();
    // MOD-E016: an Egg's count is part of the position, so waiting for it is not repetition.
    if (p.type === 'egg') sym += p.cooldowns[MODIFIER_IDS.hatchery] ?? '';
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

  // 5. MOD-A016: where Gerald's statue stands is part of the position.
  const statue = getStatueSquare(state);
  const statueToken = statue ? `|g${statue}` : '';

  // 6. MOD-C018 walls and MOD-A009 flocks block squares, so they count too.
  const barriers = Array.from(state.tiles.entries())
    .filter(([, tile]) => tile.barrier)
    .map(([sq, tile]) => `${sq}${tile.barrier!.owner?.[0] ?? 'f'}${tile.barrier!.until}`)
    .sort();
  const barrierToken = barriers.length > 0 ? `|b${barriers.join('')}` : '';

  return `${pieceTokens.join(',')}|${sideToken}|${castleToken}|${epToken}${statueToken}${barrierToken}`;
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
    const minor = pieces.find(p => p.type === 'bishop' || p.type === 'knight' || p.type === 'pigeon' || p.type === 'elephant' || p.type === 'camel' || p.type === 'egg');
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
    pieces.set(sq, {
      ...piece,
      cooldowns: { ...piece.cooldowns },
      ...(piece.abilityCooldowns ? { abilityCooldowns: { ...piece.abilityCooldowns } } : {}),
    });
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

function countOwnMove(state: GameState, next: GameState): void {
  const made = ownMovesMade(state);
  next.ownMoves = { ...made, [state.turn]: made[state.turn] + 1 };
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

/**
 * Definitions of the active modifiers, once each. An owned modifier drafted by
 * both sides has two instances, but its hooks must run once per event; the
 * definition reads every instance's owner itself.
 */
export function getActiveDefinitions(state: GameState): ModifierDefinition[] {
  const seen = new Set<string>();
  const defs: ModifierDefinition[] = [];
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const def = modifierRegistry.get(inst.id);
    if (def) defs.push(def);
  }
  return defs;
}

export function runPreMoveApplyHooks(
  state: GameState,
  move: Move,
): { state: GameState; move: Move } {
  let nextState = cloneState(state);
  let nextMove = { ...move };

  for (const def of getActiveDefinitions(state)) {
    if (def.onPreMoveApply) {
      const result = def.onPreMoveApply(nextState, nextMove);
      nextState = result.state;
      nextMove = result.move;
    }
  }

  return { state: nextState, move: nextMove };
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
    // A sideways step (MOD-E014) stays on its rank and is never en passant.
    if (to === state.flags.enPassantSquare && to[1] !== from[1]) {
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
 * MOD-A005: once the storm has taken the square ahead, the last open rank
 * counts as the back rank. Puzzle board shapes work the same way: a pawn
 * facing a closed square promotes.
 */
export function isPromotionMove(state: GameState, from: Square, to: Square): boolean {
  const piece = state.pieces.get(from);
  if (!piece || piece.type !== 'pawn') return false;
  // A sideways step (MOD-E014) stays on its rank and never promotes.
  if (from[1] === to[1]) return false;
  const toRank = rankIndex(to);
  if ((piece.color === 'white' && toRank === 7) || (piece.color === 'black' && toRank === 0)) {
    return true;
  }
  const ahead = toSquare(fileIndex(to), toRank + (piece.color === 'white' ? 1 : -1));
  const aheadTile = state.tiles.get(ahead);
  return aheadTile?.storm === 'active' || aheadTile?.isClosed === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyMoveInternal  (simulation only — no turn switch / history)
// ─────────────────────────────────────────────────────────────────────────────

export function applyMoveInternal(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  const piece = next.pieces.get(move.from);
  if (!piece) return next;

  next.flags.enPassantSquare = null;

  // MOD-A016: stepping into Gerald's statue pushes it. The piece stays put.
  const statueTo = statuePushTarget(next, move.from, move.to);
  if (statueTo) {
    moveStatue(next, move.to, statueTo);
    next.flags.halfMoveClock++;
    return next;
  }

  const isCapture = next.pieces.has(move.to) || move.isEnPassant === true;
  // A sideways pawn step (MOD-E014) can be undone, so it does not reset the clock.
  const pawnAdvance = piece.type === 'pawn' && move.from[1] !== move.to[1];
  if (pawnAdvance || isCapture) {
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

  // Double-pawn-push → set en passant square. Only a normal two-square move
  // from the pawn's starting rank counts: a MOD-E018 Zerg Rush two-square move
  // from any other rank cannot be taken en passant (and one that promotes is no
  // longer a pawn anyway).
  if (piece.type === 'pawn' && !move.promotion) {
    const rankDiff = Math.abs(rankIndex(move.to) - rankIndex(move.from));
    const startRank = piece.color === 'white' ? 1 : 6;
    if (rankDiff === 2 && rankIndex(move.from) === startRank) {
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
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '', chancellor: 'C', archbishop: 'A', elephant: 'E', camel: 'L', nightrider: 'NN', egg: 'O', royal_guard: 'G', pigeon: 'H', cannon: 'Cn', grasshopper: 'Gh', bodyguard: 'Bg',
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
  if (move.ability) return buildAbilityNotation(stateBefore, move, isCapture, stateAfter);
  if (move.isCastle === 'kingside')  return 'O-O';
  const pushedTo = statuePushTarget(stateBefore, move.from, move.to);
  if (pushedTo) {
    const pusher = stateBefore.pieces.get(move.from);
    const base = `${PIECE_SYM[pusher?.type ?? 'pawn'] ?? ''}${move.from} pushes ${move.to}-${pushedTo}`;
    const opponent: Color = move.playerColor === 'white' ? 'black' : 'white';
    if (stateAfter.status === 'checkmate') return `${base}#`;
    return isInCheck(stateAfter, opponent) ? `${base}+` : base;
  }
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

  // A sideways pawn step (MOD-E014) names its start square: d4-e4.
  if (piece.type === 'pawn' && move.from[1] === move.to[1]) disambig = `${move.from}-`;

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
  if (move.ability && modifierRegistry.get(move.ability)?.ability?.free) return applyFreeAbility(state, move);
  const bumped = bumpedPieces(state, move);
  if (bumped) return revealHiddenPieces(state, bumped, 'Your move bumped into it. Move again.', move.playerColor);
  return playTakenOverTurns(applyMoveOnce(state, move));
}

/**
 * Hidden pieces (MOD-D009, MOD-D015): the hidden pieces `move` bumps into, or
 * null when it is not a bump. A bump is a move that is legal on the board its
 * player sees (hidden pieces taken off) but not on the real board. It is
 * blamed on each hidden piece whose return alone makes the move illegal, or
 * on every hidden piece when no single one does. So a bump always reveals at
 * least one piece, and bumping can never loop.
 */
export function bumpedPieces(state: GameState, move: Move): string[] | null {
  if (move.ability || state.status !== 'active' || state.turn !== move.playerColor) return null;
  const color = move.playerColor;
  const hidden = getHiddenPieceIds(state, color);
  if (hidden.size === 0) return null;
  const mover = state.pieces.get(move.from);
  if (!mover || hidden.has(mover.id) || validateMove(state, move).valid) return null;
  if (!validateMove(withoutHiddenPieces(state, color, hidden), move).valid) return null;
  const culprits = [...hidden].filter(id => {
    const rest = new Set(hidden);
    rest.delete(id);
    return !validateMove(withoutHiddenPieces(state, color, rest), move).valid;
  });
  return culprits.length > 0 ? culprits : [...hidden];
}

/**
 * Shows hidden pieces again, with one event per piece. A bump (`bumpedBy`
 * set) keeps the turn: nothing goes in the move list and no counter moves.
 */
export function revealHiddenPieces(state: GameState, pieceIds: string[], why: string, bumpedBy?: Color): GameState {
  const ids = [...new Set(pieceIds)];
  if (ids.length === 0) return state;
  const owners = new Map<string, ModifierDefinition>();
  for (const def of getActiveDefinitions(state)) {
    for (const id of def.getHiddenPieces?.(state) ?? []) if (!owners.has(id)) owners.set(id, def);
  }
  let next = unhidePieces(cloneState(state), ids);
  for (const id of ids) {
    const piece = [...state.pieces.values()].find(p => p.id === id);
    const def = owners.get(id);
    if (!piece || !def) continue;
    const side = piece.color === 'white' ? 'White' : 'Black';
    next = appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: def.id,
      title: bumpedBy ? 'Bump!' : def.name,
      squares: [piece.square],
      message: `${side}'s hidden ${piece.type.replace('_', ' ')} on ${piece.square} is revealed. ${why}`,
    });
  }
  return next;
}

/**
 * An ability that does not cost the move (AbilitySpec.free): its effect and
 * cooldown only. The same side is still to move, nothing goes in the move
 * list and no move counter changes. The cooldown ticks on the move that
 * follows, like any other.
 */
function applyFreeAbility(state: GameState, move: Move): GameState {
  const piece = state.pieces.get(move.from);
  if (!piece) return state;
  const { state: next } = performAbility(cloneState(state), move);
  return startAbilityCooldown(next, piece.id, move.ability!);
}

function applyMoveOnce(state: GameState, move: Move): GameState {
  // Abilities skip onPreMoveApply: they already are a rule-bending move.
  const prepared = move.ability ? { state: cloneState(state), move: { ...move } } : runPreMoveApplyHooks(state, move);
  const preparedState = prepared.state;
  const preparedMove = prepared.move;
  const pieceMoved = preparedState.pieces.get(preparedMove.from)!;

  let pieceCaptured: Piece | undefined;
  let next: GameState;
  if (preparedMove.ability) {
    const result = performAbility(preparedState, preparedMove);
    pieceCaptured = result.captured;
    next = result.state;
  } else {
    // Capture lookup (before the move is applied)
    pieceCaptured = preparedMove.isEnPassant
      ? (() => {
          const dir = pieceMoved.color === 'white' ? -1 : 1;
          const capRank = rankIndex(preparedMove.to) + dir;
          return preparedState.pieces.get(toSquare(fileIndex(preparedMove.to), capRank));
        })()
      : preparedState.pieces.get(preparedMove.to);

    // Apply physical move
    next = applyMoveInternal(preparedState, preparedMove);
  }
  next = tickAbilityCooldowns(next, preparedState.turn);
  if (preparedMove.ability) next = startAbilityCooldown(next, pieceMoved.id, preparedMove.ability);

  // ── Modifier hooks: onCapture ───────────────────────────────────────────────
  const isCapture = pieceCaptured !== undefined;
  if (isCapture) {
    for (const def of getActiveDefinitions(preparedState)) {
      if (def.onCapture) {
        next = def.onCapture(next, preparedMove, pieceCaptured!);
      }
    }
  }

  // ── Modifier hooks: onPromotion ─────────────────────────────────────────────
  if (preparedMove.promotion) {
    for (const def of getActiveDefinitions(preparedState)) {
      if (def.onPromotion) {
        next = def.onPromotion(next, preparedMove);
      }
    }
  }

  // ── Modifier hooks: onPostMove ──────────────────────────────────────────────
  for (const def of getActiveDefinitions(preparedState)) {
    if (def.onPostMove) {
      next = def.onPostMove(next, preparedMove);
    }
  }

  // Hidden pieces (MOD-D009, MOD-D015): a hidden piece that gives check is revealed.
  next = revealHiddenPieces(next, [...hiddenCheckers(next, 'white'), ...hiddenCheckers(next, 'black')], 'It gives check.');

  // Switch turn & counters. A spent tempo token (MOD-C007) keeps the turn.
  const opponent: Color = preparedState.turn === 'white' ? 'black' : 'white';
  const nextColor: Color = preparedMove.extraTurn ? preparedState.turn : opponent;
  if (preparedMove.extraTurn) {
    next.tempoTokens = { ...next.tempoTokens, [preparedState.turn]: next.tempoTokens[preparedState.turn] - 1 };
  }
  next.turn = nextColor;
  next.turnNumber = preparedState.turnNumber + 1;
  countOwnMove(preparedState, next);
  if (preparedState.turn === 'black' && !preparedMove.extraTurn) {
    next.flags.fullMoveNumber = preparedState.flags.fullMoveNumber + 1;
  }

  // ── Position history (threefold-repetition) ─────────────────────────────────
  const key = positionKey(next);
  const posCount = (preparedState.positionHistory[key] ?? 0) + 1;
  next.positionHistory = { ...preparedState.positionHistory, [key]: posCount };

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
  for (const def of getActiveDefinitions(preparedState)) {
    if (def.onTurnEnd) {
      next = def.onTurnEnd(next);
    }
  }

  // ── Modifier hooks: onTurnStart (next player) — only if game still active ──
  if (next.status === 'active') {
    next = resolveBlockedTurn(beginTurn(next), 0);
  } else {
    runMatchEndHooks(next);
  }

  // ── Build notation AFTER result state is known (check/# suffix) ─────────────
  const notation = buildNotation(preparedState, preparedMove, isCapture, next);

  // Record move
  next.moveHistory = [
    ...preparedState.moveHistory,
    { move: preparedMove, pieceMoved, pieceCaptured, notation },
  ];

  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// beginTurn  (fires onTurnStart for current player — call before player input)
// ─────────────────────────────────────────────────────────────────────────────

export function beginTurn(state: GameState): GameState {
  let next = cloneState(state);
  for (const def of getActiveDefinitions(state)) {
    if (def.onTurnStart) {
      next = def.onTurnStart(next);
    }
  }
  return next;
}

/**
 * Ends the current side's turn without a move. Refused (state returned
 * unchanged) while the side to move is in check: passing would leave the
 * king in check, which TDD Stage 6 never allows.
 */
export function passTurn(state: GameState): GameState {
  return playTakenOverTurns(passTurnWithSkips(state, 0));
}

/**
 * If a modifier takes over the side to move (MOD-B001), play that move now.
 * Each played move can hand over to the next turn, so this recurses through
 * applyMove until a human (or bot) has to act.
 */
function playTakenOverTurns(state: GameState): GameState {
  if (state.status !== 'active') return state;
  for (const def of getActiveDefinitions(state)) {
    const takeover = def.takeOverTurn?.(state);
    if (!takeover) continue;
    if (!validateMove(takeover.state, takeover.move).valid) continue;
    return applyMove(takeover.state, takeover.move);
  }
  return state;
}

function passTurnWithSkips(state: GameState, skipsInARow: number): GameState {
  if (state.status !== 'active') return state;
  if (isInCheck(state, state.turn)) return state;

  let next = tickAbilityCooldowns(cloneState(state), state.turn);

  const nextColor: Color = state.turn === 'white' ? 'black' : 'white';
  next.turn = nextColor;
  next.turnNumber = state.turnNumber + 1;
  next.flags.enPassantSquare = null;
  countOwnMove(state, next);
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

  for (const def of getActiveDefinitions(state)) {
    if (def.onTurnEnd) {
      next = def.onTurnEnd(next);
    }
  }

  if (next.status === 'active') {
    next = resolveBlockedTurn(beginTurn(next), skipsInARow);
  } else {
    runMatchEndHooks(next);
  }

  return next;
}

function runMatchEndHooks(state: GameState): void {
  for (const def of getActiveDefinitions(state)) {
    def.onMatchEnd?.(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifier-aware turn resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True if the side to move has at least one move that passes the full
 * validation pipeline, modifier hooks included. Pure-chess checkmate and
 * stalemate detection cannot see modifier blocks (Gerald, Winter, pacifist).
 */
export function hasAnyValidMove(state: GameState): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color !== state.turn) continue;
    for (const to of getLegalMovesForPiece(state, piece)) {
      if (isPromotionMove(state, piece.square, to)) {
        if (getValidPromotionTypes(state, piece.square, to).length > 0) return true;
        continue;
      }
      if (validateMove(state, buildMove(state, piece.square, to)).valid) return true;
    }
  }
  // An ability that costs the turn (such as ordering a heavy King) is a move too.
  for (const piece of state.pieces.values()) {
    if (piece.color !== state.turn) continue;
    if (getAbilityOptions(state, piece.square).some(option => !option.free && option.targets.length > 0)) return true;
  }
  return false;
}

export const PROMOTION_TYPES: readonly PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

/**
 * The promotion pieces that pass full validation for this pawn move, best
 * first. Modifiers can forbid some (Reject Queen forbids the queen).
 */
export function getValidPromotionTypes(state: GameState, from: Square, to: Square): PieceType[] {
  return PROMOTION_TYPES.filter(type => {
    const move = buildMove(state, from, to);
    move.promotion = type;
    return validateMove(state, move).valid;
  });
}

/**
 * Why the side to move may not shoo Gerald now, or null. In check it may
 * not; a card that forces a move (MOD-B019) may also say no.
 */
export function getShooBlocker(state: GameState): string | null {
  if (isInCheck(state, state.turn)) return 'You are in check. Gerald stays put.';
  for (const def of getActiveDefinitions(state)) {
    const reason = def.blocksPass?.(state);
    if (reason) return reason;
  }
  return null;
}

/** The side to move may shoo Gerald (spending its turn) unless it is in check or a card forbids it. */
export function canShooGerald(state: GameState): boolean {
  if (state.status !== 'active') return false;
  if (getShooBlocker(state)) return false;
  return Array.from(state.pieces.values()).some(
    piece => piece.color === state.turn && (piece.cooldowns[GERALD_ID] ?? 0) > 0,
  );
}

/** GDD 04: the player clicks Gerald off a piece. Costs the turn. */
export function shooGerald(state: GameState): GameState {
  if (!canShooGerald(state)) return state;

  const next = cloneState(state);
  for (const [sq, piece] of next.pieces) {
    if (piece.color !== state.turn || (piece.cooldowns[GERALD_ID] ?? 0) <= 0) continue;
    const cooldowns = { ...piece.cooldowns };
    delete cooldowns[GERALD_ID];
    next.pieces.set(sq, { ...piece, cooldowns });
  }

  const shooed = appendGameEvent(next, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: GERALD_ID,
    title: 'Gerald',
    message: `${state.turn === 'white' ? 'White' : 'Black'} shoos Gerald away. Turn spent.`,
  });
  return passTurn(shooed);
}

/**
 * Runs after onTurnStart. If modifiers leave the side to move with no valid
 * action: in check it is checkmate; otherwise the turn is skipped. If both
 * sides are stuck back to back, the game is drawn as a stalemate.
 */
function resolveBlockedTurn(state: GameState, skipsInARow: number): GameState {
  if (state.status !== 'active') return state;
  if (hasAnyValidMove(state) || canShooGerald(state)) return state;

  if (isInCheck(state, state.turn)) {
    const mated = cloneState(state);
    mated.status = 'checkmate';
    runMatchEndHooks(mated);
    return mated;
  }

  if (skipsInARow >= 1) {
    const drawn = cloneState(state);
    drawn.status = 'draw';
    drawn.drawReason = 'stalemate';
    runMatchEndHooks(drawn);
    return drawn;
  }

  const skipped = appendGameEvent(state, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: 'ENGINE',
    title: 'No move',
    message: `${state.turn === 'white' ? 'White' : 'Black'} has no piece free to move. Turn skipped.`,
  });
  return passTurnWithSkips(skipped, skipsInARow + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// activateModifiers  (call after draft, before first beginTurn)
// ─────────────────────────────────────────────────────────────────────────────

export function activateModifiers(state: GameState, ids: string[]): GameState {
  return activateDraftModifiers(
    state,
    ids.map(id => ({ id, sourceColor: null })),
  );
}

export function activateDraftModifiers(
  state: GameState,
  picks: DraftModifierPick[],
): GameState {
  let next = cloneState(state);
  for (const pick of picks) {
    const def = modifierRegistry.get(pick.id);
    if (!def) continue;
    const sourceColor = getDraftScope(def.id) === 'shared' ? null : pick.sourceColor;
    next.activeModifiers = [
      ...next.activeModifiers,
      {
        id: def.id,
        name: def.name,
        activeFor: def.activeFor,
        sourceColor,
      },
    ];
    if (def.onActivate) {
      next = def.onActivate(next);
    }
  }
  return next;
}
