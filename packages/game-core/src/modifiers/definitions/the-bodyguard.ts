import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';
import { afterSwap, checkSwapPartner, swapPieces } from './freaky-friday';

const ID = MODIFIER_IDS.theBodyguard;

function neighbours(sq: Square): Square[] {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const result: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const nf = f + df;
      const nr = r + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      result.push(`${String.fromCharCode(97 + nf)}${nr + 1}` as Square);
    }
  }
  return result;
}

/** The own King next to the Bodyguard, as a swap target. The engine rejects a swap that leaves the King in check. */
export function getBodyguardSwapTargets(state: GameState, guard: Piece): Square[] {
  return neighbours(guard.square).filter(sq => {
    const piece = state.pieces.get(sq);
    return piece?.type === 'king' && piece.color === guard.color;
  });
}

/**
 * MOD-E017 The Bodyguard: a Bodyguard replaces the owner's g-pawn. It steps
 * like a King (it can be captured and never castles). As its move it may
 * swap places with its own King when they stand next to each other. The swap
 * reuses Freaky Friday's (MOD-C012) swap, so the King counts as moved.
 */
export const theBodyguardDef: ModifierDefinition = {
  id: ID,
  name: 'The Bodyguard',
  category: 'E',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    // Only before the first move: the g-pawn is still at home.
    if (state.moveHistory.length > 0) return state;
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const color of colors) {
      const square: Square = color === 'white' ? 'g2' : 'g7';
      const pawn = next.pieces.get(square);
      if (pawn?.type !== 'pawn' || pawn.color !== color) continue;
      next.pieces.set(square, { ...pawn, type: 'bodyguard' });
    }
    return next;
  },

  ability: {
    label: 'Swap with King',
    hint: 'The Bodyguard and your King trade places. Uses your move.',
    pieceTypes: ['bodyguard'],
    cooldown: 0,
    getTargets: getBodyguardSwapTargets,
    apply(state, move) {
      const guard = state.pieces.get(move.from)!;
      const next = swapPieces(state, move.from, move.to);
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'THE BODYGUARD',
          message: `The ${guard.color} Bodyguard and King swap places.`,
          squares: [move.from, move.to],
        }),
      };
    },
    notation(_state, move) {
      return `Bg${move.from}⇄K${move.to}`;
    },
  },

  // The King moves too, so it must be free to move (Gerald, Winter, the Swamp, a confession).
  onPreMoveValidate(state, move) {
    if (move.ability !== ID) return { blocked: false };
    return checkSwapPartner(state, move, ID);
  },

  onPostMove(state, move) {
    if (move.ability !== ID) return state;
    return afterSwap(state, move);
  },
};
