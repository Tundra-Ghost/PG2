import type { ModifierDefinition } from '../types';
import { prngPickIndex } from '../../engine/prng';
import { cloneState } from '../../engine/gameLoop';

const ID = 'MOD-B002';
const DISTRACTION_DURATION = 2;

export const geraldDef: ModifierDefinition = {
  id: ID,
  name: 'Gerald',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onTurnStart(state) {
    const geraldAffectsCurrentPlayer = state.activeModifiers.some(
      mod => mod.id === ID && (mod.sourceColor === null || mod.sourceColor === state.turn),
    );
    if (!geraldAffectsCurrentPlayer) return state;

    const alreadyBlocked = Array.from(state.pieces.values()).some(
      piece => piece.color === state.turn && (piece.cooldowns[ID] ?? 0) > 0,
    );
    if (alreadyBlocked) return state;

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
        cooldowns: { ...piece.cooldowns, [ID]: DISTRACTION_DURATION },
      });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (piece && (piece.cooldowns[ID] ?? 0) > 0) {
      return { blocked: true, reason: 'Gerald is still distracting that piece.' };
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    // Decrement Gerald only for the side whose turn just ended.
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      if (piece.color !== state.turn) continue;
      const cooldown = piece.cooldowns[ID] ?? 0;
      if (cooldown <= 0) continue;

      const nextCooldowns = { ...piece.cooldowns };
      if (cooldown <= 1) delete nextCooldowns[ID];
      else nextCooldowns[ID] = cooldown - 1;
      next.pieces.set(sq, { ...piece, cooldowns: nextCooldowns });
    }
    return next;
  },
};
