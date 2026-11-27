import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.footprints;
/** Footprints last 2 rounds. */
export const FOOTPRINT_PLIES = 4;

interface Footprint {
  square: Square;
  /** Shown while fewer plies than this have been played. */
  until: number;
}
type Tracks = Partial<Record<Color, Footprint[]>>;

function tracks(state: GameState): Tracks {
  return (state.modifierState[ID] as Tracks | undefined) ?? {};
}

/** Squares where `viewer` sees footprints now (empty without the card). */
export function getFootprints(state: GameState, viewer: Color): Square[] {
  if (!affectsColor(state, ID, viewer)) return [];
  const plies = state.moveHistory.length;
  return (tracks(state)[viewer] ?? []).filter(f => f.until > plies).map(f => f.square);
}

/**
 * MOD-D011: when an enemy piece moves to a square the owner cannot see, the
 * square it left shows footprints to the owner for 2 rounds. The draft only
 * offers it once a fog card is picked (draft/rules.ts).
 */
export const footprintsDef: ModifierDefinition = {
  id: ID,
  name: 'Footprints',
  category: 'D',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onPostMove(state, move) {
    const owner: Color = move.playerColor === 'white' ? 'black' : 'white';
    if (!affectsColor(state, ID, owner)) return state;
    // The piece must have left its square (not a drop, shove or pull).
    if (state.pieces.get(move.from)?.color === move.playerColor) return state;
    const visible = getVisibleSquares(state, owner);
    if (!visible || visible.has(move.to)) return state;
    const ply = state.moveHistory.length + 1;
    const kept = (tracks(state)[owner] ?? []).filter(f => f.until > ply && f.square !== move.from);
    const next = cloneState(state);
    next.modifierState = {
      ...next.modifierState,
      [ID]: { ...tracks(state), [owner]: [...kept, { square: move.from, until: ply + FOOTPRINT_PLIES }] },
    };
    return next;
  },
};
