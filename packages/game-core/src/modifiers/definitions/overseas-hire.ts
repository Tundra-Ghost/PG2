import type { ModifierDefinition } from '../types';
import type { Color, GameState, PieceType } from '../../engine/types';
import { cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

/**
 * Turns one random rook of each owner into `type`, with the seeded generator.
 * Ghost rooks (MOD-D002) are never picked. The new piece cannot castle, so
 * castling on its side is lost. Shared by the Cannon (MOD-E013) and the
 * Grasshopper (MOD-E012).
 */
export function replaceOneRook(state: GameState, id: string, type: PieceType): GameState {
  const owner = getModifierOwner(state, id);
  const colors: Color[] = owner ? [owner] : ['white', 'black'];
  const next = cloneState(state);
  for (const color of colors) {
    const rooks = Array.from(next.pieces.values()).filter(p => p.color === color && p.type === 'rook' && !p.isGhost);
    if (rooks.length === 0) continue;
    const [idx, prng] = prngPickIndex(next.prngState, rooks.length);
    next.prngState = prng;
    const rook = rooks[idx];
    next.pieces.set(rook.square, { ...rook, type });
    const homeRank = color === 'white' ? '1' : '8';
    if (rook.square === `h${homeRank}`) next.flags.castlingRights[color].kingSide = false;
    if (rook.square === `a${homeRank}`) next.flags.castlingRights[color].queenSide = false;
  }
  return next;
}

/**
 * MOD-E013 Overseas Hire: one random rook of the owner becomes a Cannon. It
 * slides like a rook onto empty squares and captures only by hopping exactly
 * one piece (the screen) on its line to take the next piece behind it. The
 * move code lives in engine/hops.ts.
 */
export const overseasHireDef: ModifierDefinition = {
  id: MODIFIER_IDS.overseasHire,
  name: 'Overseas Hire (The Cannon)',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    return replaceOneRook(state, MODIFIER_IDS.overseasHire, 'cannon');
  },
};
