import type { ModifierDefinition } from '../types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isSwampSquare, SWAMP_SQUARES } from './swamp';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.thisIsMySwamp;

// onTurnEnd ticks once at the end of the entry turn, so 3 ticks leave
// two full blocked turns for the knight (same pattern as Winter).
const KNIGHT_TRAP_TICKS = 3;

function distance(from: string, to: string): number {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(from.charCodeAt(1) - to.charCodeAt(1));
  return Math.max(df, dr);
}

export const thisIsMySwampDef: ModifierDefinition = {
  id: ID,
  name: 'This Is My Swamp',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const next = cloneState(state);
    for (const square of SWAMP_SQUARES) {
      const tile = next.tiles.get(square) ?? { square, effects: [] };
      next.tiles.set(square, { ...tile, isSwamp: true });
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (!piece) return { blocked: false };

    if ((piece.cooldowns[ID] ?? 0) > 0) {
      return { blocked: true, reason: 'That knight is stuck in the Swamp.' };
    }

    // Knights cannot make a 1-square move, so once free they leap out normally.
    // Ability moves (a knight moving like a rook) get no such pass.
    const exempt = piece.type === 'knight' && !move.ability;
    if (!exempt && isSwampSquare(move.from) && distance(move.from, move.to) > 1) {
      return { blocked: true, reason: 'In the Swamp a piece moves only 1 square.' };
    }

    return { blocked: false };
  },

  onPostMove(state, move) {
    const piece = state.pieces.get(move.to);
    if (!piece || piece.type !== 'knight') return state;
    if (!isSwampSquare(move.to) || isSwampSquare(move.from)) return state;

    const next = cloneState(state);
    next.pieces.set(move.to, {
      ...piece,
      cooldowns: { ...piece.cooldowns, [ID]: KNIGHT_TRAP_TICKS },
    });
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Swamp',
      message: `The ${piece.color} knight is stuck in the Swamp for 2 turns.`,
    });
  },

  onTurnEnd(state) {
    const next = cloneState(state);
    for (const [sq, piece] of next.pieces) {
      if (piece.color !== state.turn) continue;
      const cd = piece.cooldowns[ID] ?? 0;
      if (cd <= 0) continue;
      const cooldowns = { ...piece.cooldowns };
      if (cd <= 1) delete cooldowns[ID];
      else cooldowns[ID] = cd - 1;
      next.pieces.set(sq, { ...piece, cooldowns });
    }
    return next;
  },
};
