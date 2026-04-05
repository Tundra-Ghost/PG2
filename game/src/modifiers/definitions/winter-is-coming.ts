import type { ModifierDefinition } from '../types';
import { cloneState } from '../../engine/gameLoop';
import { isFrozenZoneSquare } from './winter';

const ID = 'MOD-A004';

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
    if (!isFrozenZoneSquare(move.to)) return state;
    if (isFrozenZoneSquare(move.from)) return state;

    // Use 2 ticks here because onTurnEnd runs immediately after the move.
    // The first tick is consumed at the end of the entry turn, leaving
    // one full blocked turn for the frozen piece's next activation.
    const next = cloneState(state);
    const p = next.pieces.get(move.to);
    if (p) {
      next.pieces.set(move.to, {
        ...p,
        cooldowns: { ...p.cooldowns, [ID]: 2 },
      });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (piece && (piece.cooldowns[ID] ?? 0) > 0) {
      return { blocked: true, reason: 'That piece is frozen by Winter is Coming.' };
    }

    if (move.isCastle) {
      const homeRank = move.playerColor === 'white' ? '1' : '8';
      const pathSquares = move.isCastle === 'kingside'
        ? ([`f${homeRank}`, `g${homeRank}`] as const)
        : ([`d${homeRank}`, `c${homeRank}`] as const);

      if (pathSquares.some(square => isFrozenZoneSquare(square))) {
        return {
          blocked: true,
          reason: 'Winter locks the castling path in ice.',
        };
      }
    }

    return { blocked: false };
  },

  onTurnEnd(state) {
    // Only decrement pieces belonging to the side whose turn just ended.
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      if (piece.color !== state.turn) continue;
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
