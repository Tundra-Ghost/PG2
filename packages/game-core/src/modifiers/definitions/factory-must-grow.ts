import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isNewRound, revealBumped, shownSlideSquares, slidePieceSafely, type Bumped } from '../../engine/conveyor';
import { offset } from '../../engine/push';
import { MODIFIER_IDS } from '../ids';
import { timedPhase } from '../timed';
import { TIDE } from './tide';

const ID = MODIFIER_IDS.factoryMustGrow;
const FILES = 'abcdefgh';

/** Rank 4 runs right (towards h), rank 5 runs left (towards a). */
export function beltDirection(sq: Square): 'east' | 'west' | null {
  if (sq[1] === '4') return 'east';
  if (sq[1] === '5') return 'west';
  return null;
}

interface FactoryState {
  /** The round the belts last ran on, so a second onTurnStart is a no-op. */
  lastRound?: number;
}

/** True while Tide Goes In (MOD-A017) floods ranks 4 and 5: the belts stop. */
function beltsFlooded(state: GameState): boolean {
  return state.activeModifiers.some(mod => mod.id === MODIFIER_IDS.tideGoesIn)
    && timedPhase(state.flags.fullMoveNumber, TIDE) === 'active';
}

/**
 * MOD-A010: at the end of each round every piece on rank 4 slides one square
 * right and every piece on rank 5 one square left. The front piece moves
 * first, so a line of pieces moves together. A piece stops at the edge or
 * behind a piece that cannot move. Slides follow engine/conveyor.ts: never a
 * capture, never a King into check.
 */
export const factoryMustGrowDef: ModifierDefinition = {
  id: ID,
  name: 'The Factory Must Grow',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    const last = (state.modifierState[ID] as FactoryState | undefined)?.lastRound;
    if (!isNewRound(state, last)) return state;
    let next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { lastRound: state.flags.fullMoveNumber } satisfies FactoryState };
    if (beltsFlooded(state)) return next;

    const moved: Square[] = [];
    const bumped: Bumped = new Set();
    const run = (rank: '4' | '5', df: 1 | -1) => {
      const files = df === 1 ? [...FILES].reverse() : [...FILES];
      for (const f of files) {
        const from = `${f}${rank}` as Square;
        const to = offset(from, df, 0);
        if (slidePieceSafely(next, from, to, bumped)) moved.push(to!);
      }
    };
    run('4', 1);
    run('5', -1);
    next = revealBumped(next, bumped);
    if (moved.length === 0) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Factory',
      message: 'The belts move. Rank 4 runs towards the h-file, rank 5 towards the a-file.',
      squares: shownSlideSquares(next, moved),
    });
  },
};
