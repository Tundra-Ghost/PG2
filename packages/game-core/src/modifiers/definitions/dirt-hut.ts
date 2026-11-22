import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { canHoldBarrier, cutsOffAKing, getBarriers, liftExpiredBarriers, placeBarriers } from '../../engine/barriers';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.dirtHut;

/** Own turns a rook waits after building. */
export const WALL_COOLDOWN = 6;
/** Plies a wall stands: 4 rounds. */
export const WALL_PLIES = 8;
/** Most walls one side may have up at a time. */
export const MAX_WALLS = 2;

export function wallCount(state: GameState, color: Color): number {
  return getBarriers(state, 'wall').filter(b => b.barrier.owner === color).length;
}

/** Empty squares next to the rook that may take a wall. */
export function getWallTargets(state: GameState, rook: Piece): Square[] {
  if (wallCount(state, rook.color) >= MAX_WALLS) return [];
  const targets: Square[] = [];
  // Under fog only squares the builder can see, so a target never gives a hidden piece away.
  const visible = getVisibleSquares(state, rook.color);
  for (const [df, dr] of ALL_DIRECTIONS) {
    const sq = offset(rook.square, df, dr);
    if (!sq || (visible && !visible.has(sq)) || !canHoldBarrier(state, sq)) continue;
    // Never take away the last legal move of either King.
    if (cutsOffAKing(state, [sq])) continue;
    targets.push(sq);
  }
  return targets;
}

/**
 * MOD-C018: your rook builds a dirt wall on an empty square next to it. The
 * wall is a timed void square (engine/barriers.ts): nothing lands on it or
 * slides through it for 4 rounds. At most 2 walls per side.
 */
export const dirtHutDef: ModifierDefinition = {
  id: ID,
  name: 'Dirt Hut',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Build wall',
    hint: 'Put a wall on an empty square next to this rook. Nothing can land on or cross it for 4 rounds.',
    pieceTypes: ['rook'],
    cooldown: WALL_COOLDOWN,
    entersTarget: false,
    getTargets: getWallTargets,
    apply(state, move) {
      const rook = state.pieces.get(move.from)!;
      const next = cloneState(state);
      placeBarriers(next, [move.to], { kind: 'wall', owner: rook.color, until: state.turnNumber + WALL_PLIES });
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Dirt Hut',
          message: `The ${rook.color} rook builds a wall on ${move.to}. It stands for 4 rounds.`,
          squares: [move.to],
        }),
      };
    },
    notation(_state, move) {
      return `R${move.from} wall ${move.to}`;
    },
    status(state, rook) {
      const left = MAX_WALLS - wallCount(state, rook.color);
      return `${left} of ${MAX_WALLS} walls left`;
    },
  },

  onTurnStart(state) {
    const { state: next, lifted } = liftExpiredBarriers(state, 'wall');
    if (lifted.length === 0) return state;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Dirt Hut',
      message: `The wall${lifted.length === 1 ? ' on ' : 's on '}${lifted.join(' and ')} crumble${lifted.length === 1 ? 's' : ''}.`,
      squares: lifted,
    });
  },
};
