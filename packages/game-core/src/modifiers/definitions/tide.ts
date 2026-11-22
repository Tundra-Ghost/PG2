import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { getActiveAbility } from '../../engine/abilities';
import { MODIFIER_IDS } from '../ids';
import { timedPhase, type TimedPhase, type TimedSchedule } from '../timed';

const ID = MODIFIER_IDS.tideGoesIn;
const FILES = 'abcdefgh';

/** Every 8 rounds, for 4 rounds, shown 1 round ahead. */
export const TIDE: TimedSchedule = { every: 16, stay: 8, warning: 2 };

export const WATER_SQUARES: Square[] = [...FILES].flatMap(f => [`${f}4`, `${f}5`] as Square[]);
const WATER = new Set<Square>(WATER_SQUARES);

/** True while ranks 4 and 5 are water. */
export function isFlooded(state: GameState): boolean {
  return state.tiles.get('a4')?.tide === 'active';
}

function setTide(state: GameState, phase: TimedPhase): GameState {
  const next = cloneState(state);
  for (const sq of WATER_SQUARES) {
    const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
    if (phase) {
      next.tiles.set(sq, { ...tile, tide: phase });
      continue;
    }
    const { tide: _t, ...rest } = tile;
    const { square: _s, effects, ...flags } = rest;
    if (effects.length === 0 && !Object.values(flags).some(Boolean)) next.tiles.delete(sq);
    else next.tiles.set(sq, rest);
  }
  next.modifierState = { ...next.modifierState, [ID]: { phase } };
  return next;
}

const MESSAGES: Record<'warning' | 'active' | 'out', string> = {
  warning: 'The tide is coming in. Ranks 4 and 5 flood next round.',
  active: 'The tide comes in. For 4 rounds only knights and Kings may stop on ranks 4 and 5. Pieces may still cross.',
  out: 'The tide goes out.',
};

/**
 * MOD-A017: every 8 rounds ranks 4 and 5 flood for 4 rounds, with a warning
 * the round before. Same schedule pattern as The Birds (modifiers/timed.ts).
 * Water is not a barrier: pieces cross it and lines of check pass over it.
 * Only knights and Kings may end a move on it.
 */
export const tideDef: ModifierDefinition = {
  id: ID,
  name: 'Tide Goes In, Tide Goes Out',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    const phase = timedPhase(state.turnNumber, TIDE);
    const was = ((state.modifierState[ID] as { phase?: TimedPhase } | undefined)?.phase) ?? null;
    if (phase === was) return state;
    const next = setTide(state, phase);
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Tide',
      message: MESSAGES[phase ?? 'out'],
      squares: WATER_SQUARES,
    });
  },

  onPreMoveValidate(state, move) {
    if (!isFlooded(state) || !WATER.has(move.to)) return { blocked: false };
    const piece = state.pieces.get(move.from);
    if (!piece || piece.type === 'knight' || piece.type === 'king') return { blocked: false };
    // An ability that acts from a distance never puts its piece on the water.
    if (move.ability && getActiveAbility(state, move.ability)?.entersTarget === false) return { blocked: false };
    return { blocked: true, reason: 'Tide: only knights and Kings can stop on the water.' };
  },
};
