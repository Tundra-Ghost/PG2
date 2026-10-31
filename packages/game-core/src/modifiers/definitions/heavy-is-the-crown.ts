import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, buildMove, cloneState } from '../../engine/gameLoop';
import { getLegalMovesForPiece, isInCheck } from '../../engine/moveGenerator';
import { affectsColor } from '../owner';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.heavyIsTheCrown;

interface Order {
  kingId: string;
  to: Square;
}

function orders(state: GameState): Partial<Record<Color, Order>> {
  return (state.modifierState[ID] as Partial<Record<Color, Order>> | undefined) ?? {};
}

/** The square each side's King is ordered to, for the board to show. */
export function getCrownOrders(state: GameState): Map<Square, Color> {
  const result = new Map<Square, Color>();
  if (!state.activeModifiers.some(mod => mod.id === ID)) return result;
  for (const color of ['white', 'black'] as const) {
    const order = orders(state)[color];
    if (order) result.set(order.to, color);
  }
  return result;
}

function withOrder(state: GameState, color: Color, order: Order | null): GameState {
  const rest = { ...orders(state) };
  if (order) rest[color] = order;
  else delete rest[color];
  const next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: rest };
  return next;
}

/** King moves that would be legal without this curse. */
function kingMoves(state: GameState, king: Piece): Square[] {
  return getLegalMovesForPiece(state, king).filter(to => {
    const after = applyMoveInternal(cloneState(state), buildMove(state, king.square, to));
    return !isInCheck(after, king.color);
  });
}

/**
 * MOD-B004 (curse): the owner's King moves in two steps. Order the move
 * (costs a turn, the King stays), then make it on a later turn. The
 * opponent sees the ordered square. In check, the King moves freely.
 */
export const heavyIsTheCrownDef: ModifierDefinition = {
  id: ID,
  name: 'Heavy Is The Crown',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Order move',
    hint: 'Heavy Is The Crown: pick where your King goes. It costs this turn. Make the move on a later turn.',
    pieceTypes: ['king'],
    cooldown: 0,
    getTargets(state, king) {
      if (isInCheck(state, king.color)) return [];
      const ordered = orders(state)[king.color];
      return kingMoves(state, king).filter(to => !(ordered?.kingId === king.id && ordered.to === to));
    },
    apply(state, move) {
      const king = state.pieces.get(move.from)!;
      const next = withOrder(state, king.color, { kingId: king.id, to: move.to });
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Heavy Is The Crown',
          squares: [move.to],
          message: `The ${king.color} king prepares to move to ${move.to}.`,
        }),
      };
    },
    notation(_state, move) {
      return `K…${move.to}`;
    },
  },

  onPreMoveValidate(state, move) {
    if (move.ability) return { blocked: false };
    const piece = state.pieces.get(move.from);
    if (!piece || piece.type !== 'king' || !affectsColor(state, ID, piece.color)) return { blocked: false };
    if (isInCheck(state, piece.color)) return { blocked: false };
    const order = orders(state)[piece.color];
    if (order?.kingId === piece.id && order.to === move.to) return { blocked: false };
    return {
      blocked: true,
      reason: 'Heavy Is The Crown: order this King move first (Order move), then make it next turn.',
    };
  },

  onPostMove(state, move) {
    if (move.ability) return state;
    const king = state.pieces.get(move.to);
    if (king?.type !== 'king' || !orders(state)[king.color]) return state;
    return withOrder(state, king.color, null);
  },
};
