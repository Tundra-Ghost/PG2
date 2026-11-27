import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.camouflage;
/** A piece blends in after staying still for this many of its owner's moves. */
export const CAMO_MOVES = 4;

interface Still {
  square: Square;
  /** The owner's moves since this piece last moved or was revealed. */
  count: number;
}
type CamoState = Record<string, Still>;

function camo(state: GameState): CamoState {
  return (state.modifierState[ID] as CamoState | undefined) ?? {};
}

function owners(state: GameState): Color[] {
  return (['white', 'black'] as const).filter(color => affectsColor(state, ID, color));
}

/** Owner's pieces that can blend in: never a King. */
function candidates(state: GameState, color: Color) {
  return [...state.pieces.values()].filter(p => p.color === color && p.type !== 'king' && !p.isRealKing);
}

/** How many more of its owner's moves this piece must stay still to blend in (0 when hidden). */
export function getCamouflageCountdown(state: GameState, pieceId: string): number | null {
  const entry = camo(state)[pieceId];
  if (!entry) return null;
  return Math.max(0, CAMO_MOVES - entry.count);
}

/**
 * MOD-D015: an owner's piece (never the King) that stays on its square for 4
 * of the owner's moves is hidden from the opponent. It shows again when it
 * moves, gives check (engine) or an enemy move bumps into it
 * (engine/visibility.ts). Then it must stay still for 4 more moves.
 */
export const camouflageDef: ModifierDefinition = {
  id: ID,
  name: 'Camouflage',
  category: 'D',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const next = cloneState(state);
    const table: CamoState = { ...camo(state) };
    for (const color of owners(state)) {
      for (const piece of candidates(state, color)) if (!table[piece.id]) table[piece.id] = { square: piece.square, count: 0 };
    }
    next.modifierState = { ...next.modifierState, [ID]: table };
    return next;
  },

  onPostMove(state, move) {
    const color = move.playerColor;
    if (!affectsColor(state, ID, color)) return state;
    const before = camo(state);
    const table: CamoState = {};
    const byId = new Map([...state.pieces.values()].map(p => [p.id, p]));
    // Other owners' entries stay as they are.
    for (const [id, entry] of Object.entries(before)) {
      const piece = byId.get(id);
      if (piece && piece.color !== color) table[id] = entry;
    }
    for (const piece of candidates(state, color)) {
      const prev = before[piece.id];
      table[piece.id] = prev && prev.square === piece.square ? { square: piece.square, count: prev.count + 1 } : { square: piece.square, count: 0 };
    }
    const next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: table };
    return next;
  },

  // Online: only the viewer's own pieces are listed, so no hidden square is sent.
  redactState(state, viewer) {
    const own = new Set([...state.pieces.values()].filter(p => p.color === viewer).map(p => p.id));
    const table = camo(state);
    return Object.fromEntries(Object.entries(table).filter(([id]) => own.has(id)));
  },

  getHiddenPieces(state) {
    const table = camo(state);
    const ids: string[] = [];
    for (const piece of state.pieces.values()) {
      const entry = table[piece.id];
      if (entry && entry.square === piece.square && entry.count >= CAMO_MOVES && affectsColor(state, ID, piece.color)) ids.push(piece.id);
    }
    return ids;
  },

  revealPieces(state, pieceIds) {
    const table = camo(state);
    if (!pieceIds.some(id => table[id])) return state;
    const next = cloneState(state);
    const updated: CamoState = { ...table };
    for (const id of pieceIds) if (updated[id]) updated[id] = { ...updated[id], count: 0 };
    next.modifierState = { ...next.modifierState, [ID]: updated };
    return next;
  },
};
