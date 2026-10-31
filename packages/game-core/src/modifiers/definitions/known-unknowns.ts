import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.knownUnknowns;
const FILES = 'abcdefgh';
/** Blind Spots move every 15 rounds. */
export const BLIND_SPOT_SHIFT_PLIES = 30;
/** Corners a Blind Spot can sit on: files a-g, ranks 3-5, so it covers the middle. */
const CORNERS: Square[] = [];
for (let f = 0; f < 7; f++) for (let r = 3; r <= 5; r++) CORNERS.push(`${FILES[f]}${r}` as Square);
const DEFAULT_SPOTS: Record<Color, Square> = { white: 'c5', black: 'e3' };

type Spots = Record<Color, Square>;

function cover(corner: Square): Square[] {
  const f = FILES.indexOf(corner[0]);
  const r = Number(corner[1]);
  return [`${FILES[f]}${r}`, `${FILES[f + 1]}${r}`, `${FILES[f]}${r + 1}`, `${FILES[f + 1]}${r + 1}`] as Square[];
}

function spots(state: GameState): Spots {
  return (state.modifierState[ID] as Spots | undefined) ?? DEFAULT_SPOTS;
}

/** The 4 squares `color` cannot see, or [] without the card. */
export function getBlindSpot(state: GameState, color: Color): Square[] {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return [];
  return cover(spots(state)[color]);
}

/** Two new Blind Spots that do not overlap and differ from the old ones. */
function placeSpots(state: GameState): GameState {
  const next = cloneState(state);
  const old = next.modifierState[ID] as Spots | undefined;
  const [wi, p1] = prngPickIndex(next.prngState, CORNERS.length);
  const white = CORNERS[wi];
  const taken = new Set(cover(white));
  const options = CORNERS.filter(c => c !== old?.black && cover(c).every(sq => !taken.has(sq)));
  const [bi, p2] = prngPickIndex(p1, options.length);
  next.prngState = p2;
  next.modifierState = { ...next.modifierState, [ID]: { white, black: options[bi] } satisfies Spots };
  return next;
}

/**
 * MOD-D004: each player has a 2×2 Blind Spot they cannot see into. The two
 * spots differ and move every 15 rounds. Players see their own outline.
 */
export const knownUnknownsDef: ModifierDefinition = {
  id: ID,
  name: 'Known Unknowns (The Rumsfeld)',
  category: 'D',
  pointCost: 2,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    return placeSpots(state);
  },

  onPostMove(state) {
    const plies = state.moveHistory.length + 1;
    if (plies % BLIND_SPOT_SHIFT_PLIES !== 0) return state;
    return appendGameEvent(placeSpots(state), {
      ply: plies,
      type: 'modifier',
      modifierId: ID,
      title: 'Known Unknowns',
      message: 'The blind spots shift.',
    });
  },

  getVisibleSquares(state, color) {
    const blind = new Set(getBlindSpot(state, color));
    const visible: Square[] = [];
    for (const file of FILES) {
      for (let r = 1; r <= 8; r++) {
        const sq = `${file}${r}` as Square;
        if (!blind.has(sq)) visible.push(sq);
      }
    }
    return visible;
  },
};
