import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece } from '../../engine/types';
import { cloneState, revealHiddenPieces } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.invisibilityCloak;
/** The cloak lasts the first 10 rounds. */
export const CLOAK_PLIES = 20;
/** Pieces the cloak is picked from. Pawns, Queens and Kings are left out. */
const CLOAKABLE = new Set<Piece['type']>(['knight', 'bishop', 'rook', 'elephant', 'camel', 'nightrider', 'chancellor', 'archbishop', 'cannon', 'grasshopper', 'pigeon']);

interface Cloak {
  pieceId: string;
  /** Hidden while turnNumber is below this. */
  until: number;
}
type CloakState = Partial<Record<Color, Cloak>>;

function cloaks(state: GameState): CloakState {
  return (state.modifierState[ID] as CloakState | undefined) ?? {};
}

/** Id of `color`'s cloaked piece, while it is still cloaked. */
export function getCloakedPiece(state: GameState, color: Color): string | null {
  return cloaks(state)[color]?.pieceId ?? null;
}

function dropCloaks(state: GameState, ids: string[]): GameState {
  const current = cloaks(state);
  const rest: CloakState = { ...current };
  for (const color of ['white', 'black'] as const) if (rest[color] && ids.includes(rest[color]!.pieceId)) delete rest[color];
  if (Object.keys(rest).length === Object.keys(current).length) return state;
  const next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: rest };
  return next;
}

/**
 * MOD-D009: one of the owner's pieces is hidden from the opponent for the
 * first 10 rounds. It shows when it captures, gives check (engine), or an
 * enemy move bumps into it (engine/visibility.ts).
 */
export const invisibilityCloakDef: ModifierDefinition = {
  id: ID,
  name: 'Invisibility Cloak',
  category: 'D',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const owners: Color[] = owner ? [owner] : ['white', 'black'];
    let next = cloneState(state);
    for (const color of owners) {
      const own = [...next.pieces.values()].filter(p => p.color === color && !p.isGhost && !p.isRealKing && p.type !== 'king');
      const pool = own.filter(p => CLOAKABLE.has(p.type));
      // Squares, not ids: ids differ each time the start position is built.
      const candidates = (pool.length > 0 ? pool : own.filter(p => p.type !== 'egg')).sort((a, b) => a.square.localeCompare(b.square));
      if (candidates.length === 0) continue;
      const [idx, prng] = prngPickIndex(next.prngState, candidates.length);
      next.prngState = prng;
      next.modifierState = { ...next.modifierState, [ID]: { ...cloaks(next), [color]: { pieceId: candidates[idx].id, until: next.turnNumber + CLOAK_PLIES } } satisfies CloakState };
    }
    return next;
  },

  getHiddenPieces(state) {
    return (['white', 'black'] as const).map(color => getCloakedPiece(state, color)).filter((id): id is string => id !== null);
  },

  revealPieces(state, pieceIds) {
    return dropCloaks(state, pieceIds);
  },

  onTurnStart(state) {
    const expired = Object.values(cloaks(state)).filter(cloak => cloak && state.turnNumber >= cloak.until).map(cloak => cloak!.pieceId);
    if (expired.length === 0) return state;
    const onBoard = expired.filter(id => [...state.pieces.values()].some(p => p.id === id));
    return dropCloaks(revealHiddenPieces(state, onBoard, 'The cloak wears off.'), expired);
  },

  onCapture(state, move, captured) {
    let next = dropCloaks(state, [captured.id]);
    const capturer = next.pieces.get(move.to);
    if (capturer && getCloakedPiece(next, capturer.color) === capturer.id) {
      next = revealHiddenPieces(next, [capturer.id], 'It captures.');
    }
    return next;
  },

  onPromotion(state, move) {
    const piece = state.pieces.get(move.to);
    if (!piece || getCloakedPiece(state, piece.color) !== piece.id) return state;
    return revealHiddenPieces(state, [piece.id], 'It promotes.');
  },
};
