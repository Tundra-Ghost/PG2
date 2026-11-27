import type { Color, GameState, MoveRecord, Piece, Square } from '../engine/types';
import { getHiddenPieceIds, getVisibleSquares, isMoveHidden } from '../engine/visibility';
import { getShownNotation, getShownType } from '../modifiers/definitions/sus';
import { modifierRegistry } from '../modifiers/registry';

export interface RedactOptions {
  /**
   * Swaps a decoy's id for one that looks like a real piece id. Ghost ids
   * name themselves, so without this the opponent could tell them apart.
   */
  aliasId?: (id: string) => string;
}

const BLANK: Square = 'a1';

/**
 * Online play: the state as `viewer` may know it. The server keeps the full
 * state for the rules and sends each seat this view, so fog and hidden-piece
 * cards cannot be beaten by reading the network payload.
 *
 * - Enemy pieces that are hidden (Invisibility Cloak, Camouflage) or stand in
 *   fog are left out.
 * - Enemy pieces show the type the viewer sees (Sus, Shell Game) and lose
 *   flags that would give them away (Ghosts).
 * - Enemy moves the viewer may not read become blank records marked hidden.
 * - Cards drop their own secret state (redactState).
 * - Position keys and unused vents are not sent.
 *
 * A finished game is sent whole: everything is shown at the end.
 */
export function redactForViewer(state: GameState, viewer: Color, options: RedactOptions = {}): GameState {
  if (state.status !== 'active') return state;
  const hidden = getHiddenPieceIds(state, viewer);
  const visible = getVisibleSquares(state, viewer);
  const alias = options.aliasId ?? ((id: string) => id);

  const mask = (piece: Piece): Piece => {
    if (piece.color === viewer) return piece;
    const shown = getShownType(state, piece, viewer);
    const id = piece.isGhost ? alias(piece.id) : piece.id;
    if (shown !== piece.type) {
      // A disguised piece keeps nothing that hints at its real type.
      return { id, type: shown, color: piece.color, square: piece.square, cooldowns: {} };
    }
    const { isGhost: _ghost, ...rest } = piece;
    return { ...rest, id };
  };

  const pieces = new Map<Square, Piece>();
  for (const [square, piece] of state.pieces) {
    if (piece.color !== viewer && (hidden.has(piece.id) || (visible && !visible.has(square)))) continue;
    pieces.set(square, mask(piece));
  }

  const moveHistory = state.moveHistory.map((record): MoveRecord => {
    if (record.pieceMoved.color === viewer) return record;
    if (isMoveHidden(state, record, viewer, visible)) return blankRecord(record, viewer);
    return {
      ...record,
      pieceMoved: mask(record.pieceMoved),
      ...(record.pieceCaptured ? { pieceCaptured: mask(record.pieceCaptured) } : {}),
      notation: getShownNotation(state, record, viewer),
    };
  });

  const modifierState = { ...state.modifierState };
  const seen = new Set<string>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const def = modifierRegistry.get(inst.id);
    if (!def?.redactState || !(inst.id in modifierState)) continue;
    const kept = def.redactState(state, viewer);
    if (kept === undefined) delete modifierState[inst.id];
    else modifierState[inst.id] = kept;
  }

  const tiles = new Map(state.tiles);
  for (const [square, tile] of tiles) {
    if (!tile.isVent) continue;
    const { isVent: _vent, ...rest } = tile;
    tiles.set(square, rest);
  }

  const last = state.moveHistory[state.moveHistory.length - 1];
  const lastHidden = last ? moveHistory[moveHistory.length - 1]?.hidden === true : false;
  return {
    ...state,
    pieces,
    tiles,
    moveHistory,
    modifierState,
    positionHistory: {},
    // An en passant square would point at a pawn that moved out of sight.
    flags: lastHidden ? { ...state.flags, enPassantSquare: null } : state.flags,
  };
}

/** A move the viewer may not read: only who moved, and a capture of the viewer's own piece. */
function blankRecord(record: MoveRecord, viewer: Color): MoveRecord {
  const color = record.pieceMoved.color;
  return {
    move: { from: BLANK, to: BLANK, playerColor: color },
    pieceMoved: { id: 'hidden', type: 'pawn', color, square: BLANK, cooldowns: {} },
    ...(record.pieceCaptured?.color === viewer ? { pieceCaptured: record.pieceCaptured } : {}),
    notation: '',
    hidden: true,
  };
}
