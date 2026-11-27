import type { ModifierDefinition } from '../types';
import type { GameState } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { timedPhase, timedStart, type TimedPhase, type TimedSchedule } from '../timed';
import { darkView } from './dark-and-scared';

const ID = MODIFIER_IDS.nightShift;

/**
 * Every 8 rounds, for 4 rounds, with dusk the round before. Counted in rounds
 * (fullMoveNumber), so night falls once Black has moved in round 8 and an
 * extra turn never moves it: night on rounds 9 to 12, 17 to 20, and so on.
 */
export const NIGHT: TimedSchedule = { every: 8, stay: 4, warning: 1 };

/** 'active' at night, 'warning' at dusk, null by day. */
export function getNightPhase(state: GameState): TimedPhase {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return null;
  return timedPhase(state.flags.fullMoveNumber, NIGHT);
}

/** The sky for the header: the time of day and how long it lasts, or null without the card. */
export function getSky(state: GameState): { night: boolean; text: string } | null {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return null;
  const round = state.flags.fullMoveNumber;
  const phase = timedPhase(round, NIGHT);
  if (phase === 'active') {
    const left = timedStart(round, NIGHT) + NIGHT.stay - round;
    return { night: true, text: left === 1 ? 'Night: last round' : `Night: ${left} rounds left` };
  }
  if (phase === 'warning') return { night: false, text: 'Dusk: night next round' };
  // The first night is in round every + 1, never round 1.
  const until = Math.max(timedStart(round, NIGHT), NIGHT.every + 1) - round;
  return { night: false, text: `Day: night in ${until} rounds` };
}

const MESSAGES: Record<'warning' | 'active' | 'day', string> = {
  warning: 'Dusk. Night falls next round.',
  active: 'Night falls. For 4 rounds each side sees only 2 squares around its own pieces.',
  day: 'The sun rises. Everyone can see again.',
};

/**
 * MOD-D010: every 8 rounds night falls for 4 rounds. At night each side sees
 * what It's Dark And I'm Scared shows (engine/visibility.ts does the rest:
 * fogged moves, bots, online redaction). Same schedule pattern as the tide
 * (modifiers/timed.ts), counted in rounds.
 */
export const nightShiftDef: ModifierDefinition = {
  id: ID,
  name: 'Night Shift',
  category: 'D',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    if (state.status !== 'active') return state;
    const phase = timedPhase(state.flags.fullMoveNumber, NIGHT);
    const was = ((state.modifierState[ID] as { phase?: TimedPhase } | undefined)?.phase) ?? null;
    if (phase === was) return state;
    const next: GameState = { ...state, modifierState: { ...state.modifierState, [ID]: { phase } } };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: phase === 'active' ? 'Night' : phase === 'warning' ? 'Dusk' : 'Day',
      message: MESSAGES[phase ?? 'day'],
    });
  },

  getVisibleSquares(state, color) {
    return getNightPhase(state) === 'active' ? darkView(state, color) : null;
  },
};
