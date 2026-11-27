import type { ModifierDefinition } from '../types';
import type { Color, GameState, MoveRecord } from '../../engine/types';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.pokerFace;

/** True when `viewer` reads only the destination of this move (the mover has Poker Face). */
export function isPokerFaced(state: GameState, record: MoveRecord, viewer: Color): boolean {
  const mover = record.pieceMoved.color;
  return mover !== viewer && affectsColor(state, ID, mover);
}

/** The opponent's log line for a Poker Face move: the square only, plus a check mark the board shows anyway. */
export function pokerFaceNotation(record: MoveRecord): string {
  // An ability may not end on move.to (a cannon shot, a swap): keep its squares, drop the piece letters.
  if (record.move.ability) return record.notation.replace(/^[A-Z]+(?=[a-h][1-8])/, '');
  const suffix = record.notation.match(/[+#]+$/)?.[0] ?? '';
  return `${record.move.to}${suffix}`;
}

/**
 * MOD-D013: display only. The opponent's move log shows only the squares
 * the owner's pieces moved to. The board and the rules are unchanged.
 */
export const pokerFaceDef: ModifierDefinition = {
  id: ID,
  name: 'Poker Face',
  category: 'D',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
