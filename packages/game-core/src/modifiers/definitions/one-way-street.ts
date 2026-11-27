import type { ModifierDefinition } from '../types';
import type { Move, Square } from '../../engine/types';
import { MODIFIER_IDS } from '../ids';
import { moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.oneWayStreet;
const REASON = 'One Way Street: the c-file runs north only and the f-file south only.';

/** The way pieces may move along a one-way file, or null for any other file. */
export function oneWayDirection(file: string): 'north' | 'south' | null {
  if (file === 'c') return 'north';
  if (file === 'f') return 'south';
  return null;
}

/** True if the move goes along a one-way file against its arrow. */
export function goesTheWrongWay(state: { pieces: ReadonlyMap<Square, { type: string }> }, move: Pick<Move, 'from' | 'to' | 'ability'>): boolean {
  if (move.ability) return false;
  if (move.from[0] !== move.to[0]) return false; // crossing or leaving the file is fine
  const way = oneWayDirection(move.from[0]);
  if (!way) return false;
  if (state.pieces.get(move.from)?.type === 'king') return false; // Kings have a motorcade
  const up = Number(move.to[1]) > Number(move.from[1]);
  return way === 'north' ? !up : up;
}

registerMoveRule(ID, () => ({
  allows: (state, move) => !goesTheWrongWay(state, move),
  reason: REASON,
  demand: false,
}));

/**
 * MOD-A020: a piece moving along the c-file may only go north (towards rank
 * 8), and along the f-file only south. Crossing or leaving the file is fine,
 * and Kings ignore it. Built as a move rule (modifiers/move-rules.ts), so it
 * never takes away the last legal move and does not apply in check.
 */
export const oneWayStreetDef: ModifierDefinition = {
  id: ID,
  name: 'One Way Street',
  category: 'A',
  pointCost: 2,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',
  ...moveRuleHooks(ID),
};
