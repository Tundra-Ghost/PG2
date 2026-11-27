import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.flashlight;
const FILES = 'abcdefgh';
/** Own moves between two lights. */
export const FLASHLIGHT_COOLDOWN = 4;

interface Light {
  center: Square;
  /** Lit while fewer plies than this have been played (1 round). */
  until: number;
}
type Lights = Partial<Record<Color, Light>>;

function lights(state: GameState): Lights {
  return (state.modifierState[ID] as Lights | undefined) ?? {};
}

/** The 3×3 area around `center`. Centres are never on the edge, so it is always whole. */
export function lightArea(center: Square): Square[] {
  const f = FILES.indexOf(center[0]);
  const r = Number(center[1]);
  const area: Square[] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) area.push(`${FILES[f + df]}${r + dr}` as Square);
  return area;
}

/** Squares `viewer` is lighting now (empty without a light). */
export function getFlashlightSquares(state: GameState, viewer: Color): Square[] {
  const light = lights(state)[viewer];
  if (!light || light.until <= state.moveHistory.length || !affectsColor(state, ID, viewer)) return [];
  return lightArea(light.center);
}

const CENTRES: Square[] = [];
for (let f = 1; f <= 6; f++) for (let r = 2; r <= 7; r++) CENTRES.push(`${FILES[f]}${r}` as Square);

/**
 * MOD-D012: the owner's King shines a light on a 3×3 area, once every 4 of
 * the owner's moves. The owner sees through every fog card there until their
 * next move. It does not use the move. The draft only offers it once a fog
 * card is picked (draft/rules.ts).
 */
export const flashlightDef: ModifierDefinition = {
  id: ID,
  name: 'Flashlight',
  category: 'D',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Flashlight',
    hint: 'Tap the middle of a 3×3 area to see through the fog there for 1 round. Does not use your move.',
    pieceTypes: ['king'],
    cooldown: FLASHLIGHT_COOLDOWN,
    entersTarget: false,
    free: true,
    getTargets(state, piece) {
      // Nothing to light while there is no fog (Night Shift by day).
      return getVisibleSquares(state, piece.color) ? CENTRES : [];
    },
    apply(state, move) {
      const next = cloneState(state);
      // Lit through this move and the opponent's reply.
      const light: Light = { center: move.to, until: state.moveHistory.length + 2 };
      next.modifierState = { ...next.modifierState, [ID]: { ...lights(state), [move.playerColor]: light } };
      const area = lightArea(move.to);
      return {
        state: appendGameEvent(next, {
          // No move is added, so the event belongs to the last move played.
          ply: state.moveHistory.length,
          type: 'modifier',
          modifierId: ID,
          title: 'Flashlight',
          squares: area,
          message: `${move.playerColor === 'white' ? 'White' : 'Black'} shines a flashlight on ${area[0]} to ${area[8]}.`,
        }),
      };
    },
  },

  getRevealedSquares(state, color) {
    return getFlashlightSquares(state, color);
  },
};
