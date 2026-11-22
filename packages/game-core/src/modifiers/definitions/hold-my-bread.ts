import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { performAbility } from '../../engine/abilities';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.holdMyBread;

/** Own turns the pawn waits after holding the bread. */
export const BREAD_COOLDOWN = 6;

interface Shield {
  pieceId: string;
  color: Color;
}

function shields(state: GameState): Shield[] {
  return (state.modifierState[ID] as Shield[] | undefined) ?? [];
}

/** Friendly pieces next to the pawn that it can shield. Never the King. */
function shieldTargets(state: GameState, pawn: Piece): Square[] {
  const targets: Square[] = [];
  for (const [df, dr] of ALL_DIRECTIONS) {
    const sq = offset(pawn.square, df, dr);
    const piece = sq ? state.pieces.get(sq) : undefined;
    if (sq && piece && piece.color === pawn.color && piece.type !== 'king') targets.push(sq);
  }
  return targets;
}

/** The piece this move would capture: the target square, en passant, or whatever an ability removes. */
function capturedIds(state: GameState, move: Move): string[] {
  if (move.ability) {
    // Abilities can remove pieces away from their target (a rook shot, a backwards swipe).
    const before = new Set(Array.from(state.pieces.values(), p => p.id));
    const after = performAbility(state, move).state;
    for (const p of after.pieces.values()) before.delete(p.id);
    return [...before];
  }
  const mover = state.pieces.get(move.from);
  const target = state.pieces.get(move.to);
  if (target && target.color !== move.playerColor) return [target.id];
  if (mover?.type === 'pawn' && move.to === state.flags.enPassantSquare && move.to[0] !== move.from[0]) {
    const passed = state.pieces.get(`${move.to[0]}${move.from[1]}` as Square);
    if (passed && passed.color !== move.playerColor) return [passed.id];
  }
  return [];
}

/** MOD-C013: a pawn shields a neighbouring friendly piece from capture for one enemy move. */
export const holdMyBreadDef: ModifierDefinition = {
  id: ID,
  name: 'Hold My Bread',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Hold my bread',
    hint: 'Pick a piece of yours next to the pawn (not the King). It cannot be captured on your opponent\'s next move.',
    pieceTypes: ['pawn'],
    cooldown: BREAD_COOLDOWN,
    entersTarget: false,
    getTargets: (state, pawn) => shieldTargets(state, pawn),
    apply(state, move) {
      const pawn = state.pieces.get(move.from)!;
      const friend = state.pieces.get(move.to)!;
      const next = cloneState(state);
      next.pieces.set(move.to, { ...friend, isShielded: true });
      next.modifierState[ID] = [...shields(state), { pieceId: friend.id, color: friend.color }];
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'HOLD MY BREAD',
          message: `The ${pawn.color} pawn on ${move.from} guards the ${friend.type} on ${move.to}. It cannot be captured next move.`,
          squares: [move.from, move.to],
        }),
      };
    },
    notation: (_state, move) => `P${move.from}+${move.to}`,
  },

  onPreMoveValidate(state, move) {
    const guarded = shields(state).filter(s => s.color !== move.playerColor).map(s => s.pieceId);
    if (guarded.length === 0) return { blocked: false };
    if (capturedIds(state, move).some(id => guarded.includes(id))) {
      return { blocked: true, reason: 'Hold My Bread: that piece is guarded this move.' };
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    const list = shields(state);
    if (list.length === 0) return state;
    // state.turn is the side about to move: the shield owner's opponent has just moved.
    const ended = list.filter(s => s.color === state.turn);
    if (ended.length === 0) return state;
    const next = cloneState(state);
    next.modifierState[ID] = list.filter(s => s.color !== state.turn);
    const ids = new Set(ended.map(s => s.pieceId));
    for (const [sq, piece] of next.pieces) {
      if (ids.has(piece.id) && piece.isShielded) next.pieces.set(sq, { ...piece, isShielded: false });
    }
    return next;
  },
};
