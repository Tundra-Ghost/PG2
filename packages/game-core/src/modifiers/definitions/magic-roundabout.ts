import type { ModifierDefinition } from '../types';
import type { Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isNewRound, revealBumped, slidePieceSafely, type Bumped } from '../../engine/conveyor';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.magicRoundabout;

/** Clockwise as White sees it: each square and the square after it. */
export const ROUNDABOUT_NEXT: Readonly<Record<string, Square>> = { d5: 'e5', e5: 'e4', e4: 'd4', d4: 'd5' };
export const ROUNDABOUT_SQUARES = Object.keys(ROUNDABOUT_NEXT) as Square[];

interface RoundaboutState {
  /** The round it last turned on, so a second onTurnStart is a no-op. */
  lastRound?: number;
}

/**
 * MOD-A013: at the end of each round, pieces on d4, e4, e5 and d5 move one
 * step clockwise if the next square is free. A piece whose next square is
 * freed during the turn follows, so a queue moves together; with all four
 * squares full nothing moves. Each piece moves at most once per round.
 * Slides follow engine/conveyor.ts: never a capture, never a King into check.
 */
export const magicRoundaboutDef: ModifierDefinition = {
  id: ID,
  name: 'The Magic Roundabout',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    const last = (state.modifierState[ID] as RoundaboutState | undefined)?.lastRound;
    if (!isNewRound(state, last)) return state;
    let next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { lastRound: state.flags.fullMoveNumber } satisfies RoundaboutState };

    const bumped: Bumped = new Set();
    const done = new Set<string>();
    const moved: Square[] = [];
    // Repeat until nothing more can move, so a queue follows the piece in front.
    let changed = true;
    while (changed) {
      changed = false;
      for (const from of ROUNDABOUT_SQUARES) {
        const piece = next.pieces.get(from);
        if (!piece || done.has(piece.id)) continue;
        const to = ROUNDABOUT_NEXT[from];
        if (slidePieceSafely(next, from, to)) {
          done.add(piece.id);
          moved.push(to);
          changed = true;
        }
      }
    }
    // Pieces still waiting: reveal any hidden piece that blocks them.
    for (const from of ROUNDABOUT_SQUARES) {
      const piece = next.pieces.get(from);
      if (piece && !done.has(piece.id)) slidePieceSafely(next, from, ROUNDABOUT_NEXT[from], bumped);
    }
    next = revealBumped(next, bumped);
    if (moved.length === 0) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Roundabout',
      message: 'The roundabout turns one step clockwise.',
      squares: moved,
    });
  },
};
