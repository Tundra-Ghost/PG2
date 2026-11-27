import type { ModifierDefinition } from '../types';
import type { GameState, Move } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { prngPickIndex, prngStep } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { allValidMoves } from './you-died';

const ID = MODIFIER_IDS.speedrun;

/** Seconds the owner has for each move. */
export const SPEEDRUN_SECONDS = 15;

/** True when the side to move is on the Speedrun clock. */
export function isOnSpeedrunClock(state: GameState): boolean {
  return state.status === 'active' && affectsColor(state, ID, state.turn);
}

/**
 * MOD-B009: the move played when the clock runs out, picked with the game
 * seed from every fully legal normal move (never one that leaves the King in
 * check, never an ability). Null without the card or with no legal move.
 * The pick reads the seed without using it up; the move itself advances it,
 * so a replay of the move list gives the same game.
 */
export function speedrunTimeoutMove(state: GameState): Move | null {
  if (!isOnSpeedrunClock(state)) return null;
  const moves = allValidMoves(state);
  if (moves.length === 0) return null;
  const [idx] = prngPickIndex(state.prngState, moves.length);
  return { ...moves[idx], timedOut: true };
}

const same = (a: Move, b: Move) => a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null);

/**
 * MOD-B009: the owner has 15 seconds per move (the timer lives in the client
 * and pauses while a popup is open). When it runs out the client plays
 * speedrunTimeoutMove, marked `timedOut`. The engine only accepts a timed-out
 * move that is exactly the seeded pick, so a client cannot choose it.
 */
export const speedrunDef: ModifierDefinition = {
  id: ID,
  name: 'Speedrun Any%',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',

  onPreMoveValidate(state, move) {
    if (!move.timedOut) return { blocked: false };
    const pick = speedrunTimeoutMove(state);
    if (!pick || !same(pick, move) || move.ability || move.extraTurn) {
      return { blocked: true, reason: 'Speedrun: only the seeded random move can be played on a timeout.' };
    }
    return { blocked: false };
  },

  onPostMove(state, move) {
    if (!move.timedOut) return state;
    const [, prngState] = prngStep(state.prngState);
    return appendGameEvent({ ...state, prngState }, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Speedrun',
      message: `${move.playerColor === 'white' ? 'White' : 'Black'} ran out of time. A random move was played: ${move.from} to ${move.to}.`,
      squares: [move.from, move.to],
    });
  },
};
