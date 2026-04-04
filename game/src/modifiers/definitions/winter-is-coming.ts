import type { ModifierDefinition } from '../types';
import { cloneState } from '../../engine/gameLoop';

const ID = 'MOD-A004';

/** Returns true if `rank` is in the opponent's home zone for the given color. */
function isOpponentHomeZone(color: 'white' | 'black', rank: string): boolean {
  return color === 'white' ? rank === '7' || rank === '8' : rank === '1' || rank === '2';
}

export const winterIsComingDef: ModifierDefinition = {
  id: ID,
  name: 'Winter is Coming',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onPostMove(state, move) {
    const piece = state.pieces.get(move.to);
    if (!piece) return state;
    if (!isOpponentHomeZone(piece.color, move.to[1])) return state;

    // Freeze the piece for 1 turn
    const next = cloneState(state);
    const p = next.pieces.get(move.to);
    if (p) {
      next.pieces.set(move.to, {
        ...p,
        cooldowns: { ...p.cooldowns, [ID]: 1 },
      });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (piece && (piece.cooldowns[ID] ?? 0) > 0) {
      return { blocked: true, reason: 'That piece is frozen by Winter is Coming.' };
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    // Decrement freeze cooldowns at end of turn
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      const cd = piece.cooldowns[ID] ?? 0;
      if (cd > 0) {
        const newCooldowns = { ...piece.cooldowns };
        if (cd <= 1) delete newCooldowns[ID];
        else newCooldowns[ID] = cd - 1;
        next.pieces.set(sq, { ...piece, cooldowns: newCooldowns });
      }
    }
    return next;
  },
};
