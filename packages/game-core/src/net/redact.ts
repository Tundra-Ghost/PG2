import type { Color, GameEvent, GameFlags, GameState, MoveRecord, Piece, Square } from '../engine/types';
import { pieceAttackSquares } from '../engine/moveGenerator';
import { getHiddenPieceIds, getVisibleSquares, isMoveHidden } from '../engine/visibility';
import { getShownNotation, getShownType } from '../modifiers/definitions/sus';
import { MODIFIER_IDS } from '../modifiers/ids';
import { affectsColor } from '../modifiers/owner';
import { modifierRegistry } from '../modifiers/registry';

export interface RedactOptions {
  /**
   * Swaps an enemy piece id for an opaque one, stable for the game. Some ids
   * name the piece (Ghosts, Stonks, eggs), so without this the opponent
   * could read a disguise or a decoy from the id.
   */
  aliasId?: (id: string) => string;
  /**
   * Whether each event was shown to this viewer when it first happened, by
   * event id. Filled in here for new events. Keeping it lets an event that
   * was public stay readable after its square goes dark.
   */
  eventShown?: Map<string, boolean>;
}

const BLANK: Square = 'a1';
/** Visible status marks any piece may carry. */
const STATUS_FLAGS = ['isShielded', 'isTouched', 'isTraitor', 'isBerserker', 'isPacifist'] as const;
/** Marks that only some piece types carry, so a disguise drops them. */
const TYPE_FLAGS = ['isAmazon', 'isDoubting', 'hasPromotionChain', 'isRealKing'] as const;

/**
 * Online play: the state as `viewer` may know it. The server keeps the full
 * state for the rules and sends each seat this view, so fog and hidden-piece
 * cards cannot be beaten by reading the network payload.
 *
 * - Enemy pieces that are hidden (Invisibility Cloak, Camouflage) or stand in
 *   fog are left out. A fogged piece giving check stays, like offline.
 * - Every enemy piece is sent with the same fields: an opaque id, the type
 *   the viewer sees (Sus, Shell Game), visible status marks, and ability
 *   timers only for a viewer with Tells. Decoy marks (Ghosts) are dropped.
 * - Enemy moves the viewer may not read become blank records marked hidden.
 * - Events on squares the viewer could not see are blanked.
 * - Cards drop their own secret state (redactState), and enemy ids inside
 *   card state get the same aliases.
 * - The random seed, position keys, unused vents and flags that would
 *   give a hidden move away are not sent.
 *
 * A finished game is sent whole: everything is shown at the end.
 */
export function redactForViewer(state: GameState, viewer: Color, options: RedactOptions = {}): GameState {
  if (state.status !== 'active') return state;
  const enemy: Color = viewer === 'white' ? 'black' : 'white';
  const hidden = getHiddenPieceIds(state, viewer);
  const visible = getVisibleSquares(state, viewer);
  const alias = options.aliasId ?? ((id: string) => id);
  const tells = affectsColor(state, MODIFIER_IDS.tells, viewer);
  const enemyIds = new Map<string, string>();
  const idOf = (id: string) => {
    let out = enemyIds.get(id);
    if (out === undefined) enemyIds.set(id, (out = alias(id)));
    return out;
  };

  const project = (piece: Piece): Piece => {
    if (piece.color === viewer) return piece;
    const type = getShownType(state, piece, viewer);
    const disguised = type !== piece.type;
    const out: Piece = { id: idOf(piece.id), type, color: piece.color, square: piece.square, cooldowns: {} };
    for (const flag of STATUS_FLAGS) if (piece[flag]) out[flag] = true;
    if (!disguised) {
      for (const flag of TYPE_FLAGS) if (piece[flag]) out[flag] = true;
      if (tells) {
        out.cooldowns = piece.cooldowns;
        if (piece.abilityCooldowns) out.abilityCooldowns = piece.abilityCooldowns;
      }
    }
    return out;
  };

  const kings = [...state.pieces.values()].filter(p => p.color === viewer && p.type === 'king').map(p => p.square);
  const pieces = new Map<Square, Piece>();
  for (const [square, piece] of state.pieces) {
    if (piece.color !== viewer) {
      if (hidden.has(piece.id)) continue;
      // A piece in fog stays only while it gives check: the check shows anyway.
      if (visible && !visible.has(square) && !pieceAttackSquares(state, piece).some(sq => kings.includes(sq))) continue;
    }
    pieces.set(square, project(piece));
  }

  const moveHistory = state.moveHistory.map((record): MoveRecord => {
    if (record.pieceMoved.color === viewer) {
      return record.pieceCaptured ? { ...record, pieceCaptured: project(record.pieceCaptured) } : record;
    }
    if (isMoveHidden(state, record, viewer, visible)) return blankRecord(record, viewer);
    // MOD-D019: the enemy's mark is a real piece id; the card state carries it when it may be seen.
    const { spoiler: _spoiler, ...move } = record.move;
    return {
      ...record,
      move,
      pieceMoved: project(record.pieceMoved),
      ...(record.pieceCaptured ? { pieceCaptured: project(record.pieceCaptured) } : {}),
      notation: getShownNotation(state, record, viewer),
    };
  });

  const shownSquare = (sq: Square) => {
    if (visible && !visible.has(sq)) return false;
    const piece = state.pieces.get(sq);
    return !(piece && hidden.has(piece.id));
  };
  const eventShown = options.eventShown ?? new Map<string, boolean>();
  const eventHistory = state.eventHistory.map((event): GameEvent => {
    let shown = eventShown.get(event.id);
    if (shown === undefined) {
      shown = (event.squares ?? []).every(shownSquare);
      eventShown.set(event.id, shown);
    }
    return shown ? event : { id: event.id, ply: event.ply, type: event.type, modifierId: event.modifierId, title: event.title, message: 'Something happens out of sight.' };
  });

  let modifierState: Record<string, unknown> = { ...state.modifierState };
  const seen = new Set<string>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const def = modifierRegistry.get(inst.id);
    if (!def?.redactState) continue;
    const kept = def.redactState(state, viewer);
    if (kept === undefined) delete modifierState[inst.id];
    else modifierState[inst.id] = kept;
  }
  // Every enemy id the viewer could meet gets its alias, inside card state too.
  for (const piece of state.pieces.values()) if (piece.color === enemy) idOf(piece.id);
  for (const record of state.moveHistory) {
    for (const piece of [record.pieceMoved, record.pieceCaptured]) if (piece && piece.color === enemy) idOf(piece.id);
  }
  modifierState = replaceIds(modifierState, enemyIds) as Record<string, unknown>;

  const tiles = new Map(state.tiles);
  for (const [square, tile] of tiles) {
    if (!tile.isVent) continue;
    const { isVent: _vent, ...rest } = tile;
    tiles.set(square, rest);
  }

  const secret = visible !== null || hidden.size > 0;
  const lastHidden = moveHistory[moveHistory.length - 1]?.hidden === true;
  const flags: GameFlags = secret
    ? {
        ...state.flags,
        // A reset clock or lost castling right would tell that a hidden piece moved.
        halfMoveClock: 0,
        castlingRights: { ...state.flags.castlingRights, [enemy]: { kingSide: true, queenSide: true } },
        // An en passant square would point at a pawn that moved out of sight.
        enPassantSquare: lastHidden ? null : state.flags.enPassantSquare,
      }
    : state.flags;

  return {
    ...state,
    pieces,
    tiles,
    moveHistory,
    eventHistory,
    modifierState,
    positionHistory: {},
    // The seed replays every random pick, past and future.
    prngSeed: 0,
    prngState: 0,
    flags,
  };
}

/** Copies `value`, swapping any string (or object key) that is an enemy id for its alias. */
function replaceIds(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => replaceIds(item, ids));
  if (value && typeof value === 'object') {
    if (value instanceof Map || value instanceof Set) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [ids.get(key) ?? key, replaceIds(item, ids)]));
  }
  return value;
}

/** A move the viewer may not read: only who moved, and a capture of the viewer's own piece. */
function blankRecord(record: MoveRecord, viewer: Color): MoveRecord {
  const color = record.pieceMoved.color;
  return {
    move: { from: BLANK, to: BLANK, playerColor: color, ...(record.move.extraTurn ? { extraTurn: true } : {}) },
    pieceMoved: { id: 'hidden', type: 'pawn', color, square: BLANK, cooldowns: {} },
    ...(record.pieceCaptured?.color === viewer ? { pieceCaptured: record.pieceCaptured } : {}),
    notation: '',
    hidden: true,
  };
}
