import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { DIAGONAL_DIRS, findScreen } from '../../engine/hops';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.leapOfFaith;

/** Own turns the bishop waits after a leap. */
export const LEAP_COOLDOWN = 5;

/**
 * Where the bishop can leap: on each diagonal, over the first piece to the
 * empty square right behind it. Under fog, both the hopped piece and the
 * landing square must be in view, so a target never gives a hidden piece away.
 */
export function getLeapTargets(state: GameState, bishop: Piece): Square[] {
  const visible = getVisibleSquares(state, bishop.color);
  const targets: Square[] = [];
  for (const [df, dr] of DIAGONAL_DIRS) {
    const found = findScreen(state, bishop.square, df, dr);
    const landing = found?.behind[0];
    if (!found || !landing || state.pieces.has(landing)) continue;
    if (visible && (!visible.has(found.screen) || !visible.has(landing))) continue;
    targets.push(landing);
  }
  return targets;
}

/**
 * MOD-C010 Leap Of Faith: a bishop jumps the first piece on a diagonal and
 * lands on the empty square behind it. No capture. The hop code is shared
 * with the Cannon and the Grasshopper (engine/hops.ts). The default ability
 * apply moves the bishop like a normal move, and the engine rejects any leap
 * that leaves the King in check.
 */
export const leapOfFaithDef: ModifierDefinition = {
  id: ID,
  name: 'Leap Of Faith',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Leap of faith',
    hint: 'Jump the first piece on a diagonal and land on the empty square behind it. No capture.',
    pieceTypes: ['bishop'],
    cooldown: LEAP_COOLDOWN,
    getTargets: getLeapTargets,
    notation(_state, move) {
      return `B${move.from}↷${move.to}`;
    },
  },
};
