import type { ModifierDefinition } from '../types';
import type { Color, GameState } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { affectsColor } from '../owner';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.fiftyFirstMoves;
/** A blackout starts every this many moves. */
export const BLACKOUT_EVERY = 6;
/** And lasts this many moves. */
export const BLACKOUT_LENGTH = 3;

function inBlackoutWindow(state: GameState): boolean {
  const move = state.flags.fullMoveNumber;
  return move >= BLACKOUT_EVERY && move % BLACKOUT_EVERY < BLACKOUT_LENGTH;
}

/** True while `color` cannot read the move history (MOD-B005). */
export function isHistoryBlackout(state: GameState, color: Color): boolean {
  return state.activeModifiers.some(mod => mod.id === ID)
    && affectsColor(state, ID, color)
    && inBlackoutWindow(state);
}

/** Moves left until the history comes back, 0 outside a blackout. */
export function blackoutMovesLeft(state: GameState): number {
  if (!inBlackoutWindow(state)) return 0;
  return BLACKOUT_LENGTH - (state.flags.fullMoveNumber % BLACKOUT_EVERY);
}

/** MOD-B005: every 6 moves, the cursed side forgets the move history for 3 moves. */
export const fiftyFirstMovesDef: ModifierDefinition = {
  id: ID,
  name: '50 First Moves',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',

  onPreMoveValidate(state, move) {
    const remembersPawn = move.isEnPassant || move.ability === MODIFIER_IDS.bankedEnPassant;
    if (remembersPawn && isHistoryBlackout(state, move.playerColor)) {
      return { blocked: true, reason: '50 First Moves: you do not remember that pawn moving.' };
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    // A new move number starts when white is about to move.
    if (state.turn !== 'white') return state;
    const phase = state.flags.fullMoveNumber % BLACKOUT_EVERY;
    if (state.flags.fullMoveNumber < BLACKOUT_EVERY || (phase !== 0 && phase !== BLACKOUT_LENGTH)) return state;
    const forgetting = phase === 0;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: '50 FIRST MOVES',
      message: forgetting
        ? 'The move history is gone. Nobody remembers anything for 3 moves.'
        : 'Memories return. The move history is back.',
    });
  },
};
