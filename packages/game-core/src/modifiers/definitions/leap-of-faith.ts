import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { DIAGONAL_DIRS, findScreen, lineSquares } from '../../engine/hops';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { getInfectedReach } from './cordyceptic-spread';

const ID = MODIFIER_IDS.leapOfFaith;

/** Own turns the bishop waits after a leap. */
export const LEAP_COOLDOWN = 5;

/**
 * Where the bishop can leap: on each diagonal, over the first piece to the
 * empty square right behind it. Under fog, the whole path (the squares
 * before the jumped piece, the piece and the landing square) must be in
 * view, so a target never gives a hidden piece away. A bishop slowed by The
 * Cordyceptic Spread cannot leap, like a slowed King cannot run.
 */
export function getLeapTargets(state: GameState, bishop: Piece): Square[] {
  if (getInfectedReach(state, bishop.square) !== null) return [];
  const visible = getVisibleSquares(state, bishop.color);
  const targets: Square[] = [];
  for (const [df, dr] of DIAGONAL_DIRS) {
    const found = findScreen(state, bishop.square, df, dr);
    const landing = found?.behind[0];
    if (!found || !landing || state.pieces.has(landing)) continue;
    if (visible) {
      const line = lineSquares(state, bishop.square, df, dr);
      const path = line.slice(0, line.indexOf(landing) + 1);
      if (path.some(sq => !visible.has(sq))) continue;
    }
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
      // Squares only, so a Sus disguise is never given away.
      return `${move.from}↷${move.to}`;
    },
  },
};
