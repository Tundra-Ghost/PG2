import type { ModifierDefinition } from '../types';
import { prngPickIndex } from '../../engine/prng';
import { cloneState } from '../../engine/gameLoop';

const ID = 'MOD-B007';

export const conscientiousObjectorDef: ModifierDefinition = {
  id: ID,
  name: 'Conscientious Objector',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = [...state.activeModifiers]
      .reverse()
      .find(mod => mod.id === ID)?.sourceColor ?? null;
    const pawns = Array.from(state.pieces.values()).filter(
      p => p.type === 'pawn' && (owner === null || p.color === owner),
    );
    if (pawns.length === 0) return state;

    const next = cloneState(state);
    const [idx, nextPrng] = prngPickIndex(state.prngState, pawns.length);
    next.prngState = nextPrng;

    const target = pawns[idx];
    const piece = next.pieces.get(target.square);
    if (piece) {
      next.pieces.set(target.square, { ...piece, isPacifist: true });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (!piece?.isPacifist) return { blocked: false };

    const isCapture = state.pieces.has(move.to) || move.isEnPassant === true;
    if (isCapture) {
      return { blocked: true, reason: 'The Conscientious Objector refuses to capture.' };
    }
    return { blocked: false };
  },

};
