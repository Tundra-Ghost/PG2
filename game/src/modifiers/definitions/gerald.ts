import type { ModifierDefinition } from '../types';
import { prngPickIndex } from '../../engine/prng';
import { cloneState } from '../../engine/gameLoop';

const ID = 'MOD-B002';

export const geraldDef: ModifierDefinition = {
  id: ID,
  name: 'Gerald',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',

  onTurnStart(state) {
    // Pick one random non-king piece belonging to the current player and lock it.
    const candidates = Array.from(state.pieces.values()).filter(
      p => p.color === state.turn && p.type !== 'king',
    );
    if (candidates.length === 0) return state;

    const next = cloneState(state);
    const [idx, nextPrng] = prngPickIndex(state.prngState, candidates.length);
    next.prngState = nextPrng;

    const target = candidates[idx];
    const piece = next.pieces.get(target.square);
    if (piece) {
      next.pieces.set(target.square, {
        ...piece,
        cooldowns: { ...piece.cooldowns, [ID]: 1 },
      });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (piece && (piece.cooldowns[ID] ?? 0) > 0) {
      return { blocked: true, reason: "Gerald has blocked that piece this turn." };
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    // Clear all Gerald cooldowns at end of turn.
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      if ((piece.cooldowns[ID] ?? 0) > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [ID]: _removed, ...rest } = piece.cooldowns;
        next.pieces.set(sq, { ...piece, cooldowns: rest });
      }
    }
    return next;
  },
};
