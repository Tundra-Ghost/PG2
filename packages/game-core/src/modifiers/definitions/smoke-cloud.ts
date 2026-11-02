import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.smokeCloud;
const FILES = 'abcdefgh';
/** A timed cloud appears every 10 rounds. */
export const SMOKE_EVERY_PLIES = 20;
/** A cloud lasts 3 rounds. */
export const SMOKE_PLIES = 6;
/** Timed clouds land somewhere in the middle of the board. */
const TIMED_CORNERS: Square[] = [];
for (let f = 1; f <= 5; f++) for (let r = 3; r <= 5; r++) TIMED_CORNERS.push(`${FILES[f]}${r}` as Square);

interface Cloud {
  /** Bottom-left square of the 2×2. */
  corner: Square;
  /** The side that made it, and sees through it. */
  owner: Color;
  /** Last ply the cloud stays. */
  until: number;
}

function clouds(state: GameState): Cloud[] {
  const plies = state.moveHistory.length;
  return ((state.modifierState[ID] as Cloud[] | undefined) ?? []).filter(cloud => cloud.until > plies);
}

function cover(corner: Square): Square[] {
  const f = FILES.indexOf(corner[0]);
  const r = Number(corner[1]);
  return [`${FILES[f]}${r}`, `${FILES[f + 1]}${r}`, `${FILES[f]}${r + 1}`, `${FILES[f + 1]}${r + 1}`] as Square[];
}

/** The 2×2 corner that keeps a cloud around `square` on the board. */
function cornerAt(square: Square): Square {
  const f = Math.min(FILES.indexOf(square[0]), 6);
  const r = Math.min(Number(square[1]), 7);
  return `${FILES[f]}${r}` as Square;
}

/** Every smoky square and who made it, for the board to draw. */
export function getSmokeSquares(state: GameState): Map<Square, Color> {
  const result = new Map<Square, Color>();
  if (!state.activeModifiers.some(mod => mod.id === ID)) return result;
  for (const cloud of clouds(state)) for (const sq of cover(cloud.corner)) result.set(sq, cloud.owner);
  return result;
}

function addCloud(state: GameState, corner: Square, owner: Color): GameState {
  const plies = state.moveHistory.length + 1;
  const next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: [...clouds(state), { corner, owner, until: plies + SMOKE_PLIES }] };
  return appendGameEvent(next, {
    ply: plies,
    type: 'modifier',
    modifierId: ID,
    title: 'What\'s In The Cloud, Bro',
    squares: cover(corner),
    message: `Smoke rolls over ${cover(corner)[0]}-${cover(corner)[3]}. The ${owner} side sees through it.`,
  });
}

/**
 * MOD-D003: every 10 rounds, and on each capture, a 2×2 smoke cloud appears
 * for 3 rounds. The side that made it sees through it; the other side does
 * not see pieces inside.
 */
export const smokeCloudDef: ModifierDefinition = {
  id: ID,
  name: 'What\'s In The Cloud, Bro',
  category: 'D',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onCapture(state, move, captured) {
    return addCloud(state, cornerAt(move.to), captured.color === 'white' ? 'black' : 'white');
  },

  onPostMove(state) {
    const plies = state.moveHistory.length + 1;
    if (plies % SMOKE_EVERY_PLIES !== 0) return state;
    const [idx, prng] = prngPickIndex(state.prngState, TIMED_CORNERS.length);
    const next = addCloud(state, TIMED_CORNERS[idx], state.turn);
    next.prngState = prng;
    return next;
  },

  getVisibleSquares(state, color) {
    const smoke = getSmokeSquares(state);
    const visible: Square[] = [];
    for (const file of FILES) {
      for (let r = 1; r <= 8; r++) {
        const sq = `${file}${r}` as Square;
        const owner = smoke.get(sq);
        if (owner === undefined || owner === color) visible.push(sq);
      }
    }
    return visible;
  },
};
