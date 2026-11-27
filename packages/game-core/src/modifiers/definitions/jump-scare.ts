import type { ModifierDefinition } from '../types';
import type { GameState } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { timedPhase, timedStart, type TimedPhase, type TimedSchedule } from '../timed';

const ID = MODIFIER_IDS.jumpScare;

/**
 * One dark round every 10, warned the round before. Counted in rounds
 * (fullMoveNumber): the lights flicker in round 10 and go out in round 11,
 * then 20 and 21, and so on. An extra turn never moves it.
 */
export const BLACKOUT: TimedSchedule = { every: 10, stay: 1, warning: 1 };

interface ScareState {
  phase: TimedPhase;
  /** Pieces shown again this dark round (a bump, a check). */
  revealed: string[];
}

function scare(state: GameState): ScareState {
  return (state.modifierState[ID] as ScareState | undefined) ?? { phase: null, revealed: [] };
}

function inPlay(state: GameState): boolean {
  return state.activeModifiers.some(mod => mod.id === ID);
}

/** True during the dark round: every piece but the Kings is hidden. */
export function isLightsOut(state: GameState): boolean {
  return inPlay(state) && state.status === 'active' && timedPhase(state.flags.fullMoveNumber, BLACKOUT) === 'active';
}

/** The status chip: the lights, or null without the card. */
export function getLights(state: GameState): { dark: boolean; text: string } | null {
  if (!inPlay(state)) return null;
  const round = state.flags.fullMoveNumber;
  const phase = timedPhase(round, BLACKOUT);
  if (phase === 'active') return { dark: true, text: 'Lights out: move from memory' };
  if (phase === 'warning') return { dark: false, text: 'Lights flicker: out next round' };
  const until = Math.max(timedStart(round, BLACKOUT), BLACKOUT.every + 1) - round;
  return { dark: false, text: `Lights out in ${until} rounds` };
}

const MESSAGES: Record<'warning' | 'active' | 'on', { title: string; message: string }> = {
  warning: { title: 'The lights flicker', message: 'Next round the lights go out. Remember the board.' },
  active: { title: 'Lights out!', message: 'For one round every piece but your King is hidden. Move from memory. A move that is not legal is turned down and you pick again.' },
  on: { title: 'Lights on', message: 'The lights come back on.' },
};

/**
 * MOD-D016: every 10 rounds, one round where every piece except the Kings is
 * hidden from the opponent (engine/visibility.ts: bumps, checks, bots and
 * online redaction), and the board draws each player's own pieces dark too.
 * A blind move that is not legal is a bump: it reveals what blocked it and
 * the player moves again, so no move is lost.
 */
export const jumpScareDef: ModifierDefinition = {
  id: ID,
  name: 'Jump Scare',
  category: 'D',
  pointCost: 2,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    if (state.status !== 'active') return state;
    const phase = timedPhase(state.flags.fullMoveNumber, BLACKOUT);
    const was = scare(state).phase;
    if (phase === was) return state;
    const next: GameState = { ...state, modifierState: { ...state.modifierState, [ID]: { phase, revealed: [] } satisfies ScareState } };
    const text = MESSAGES[phase ?? 'on'];
    return appendGameEvent(next, { ply: state.moveHistory.length + 1, type: 'modifier', modifierId: ID, ...text });
  },

  getHiddenPieces(state) {
    if (!isLightsOut(state)) return [];
    const revealed = new Set(scare(state).phase === 'active' ? scare(state).revealed : []);
    return [...state.pieces.values()].filter(p => p.type !== 'king' && !p.isRealKing && !revealed.has(p.id)).map(p => p.id);
  },

  // Online: redactForViewer leaves out every piece this hides, so no
  // redactState is needed. The revealed list names only pieces in view.
  revealPieces(state, pieceIds) {
    if (!isLightsOut(state)) return state;
    const current = scare(state);
    const revealed = [...new Set([...current.revealed, ...pieceIds])];
    return { ...state, modifierState: { ...state.modifierState, [ID]: { phase: 'active', revealed } satisfies ScareState } };
  },
};
