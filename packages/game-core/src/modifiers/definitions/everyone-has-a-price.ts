import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { getHiddenPieceIds, getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getShownType } from './sus';
import { isCup } from './shell-game';

const ID = MODIFIER_IDS.everyoneHasAPrice;

/** Own turns the Queen waits after a bribe (card type line). */
export const BRIBE_COOLDOWN = 12;

/**
 * Ranks a pawn of `color` may be bribed on: its own half, but never where it
 * could promote for its new side on the next move (the card's balance note).
 * That is the rank next to its own back rank, and also the one after it when
 * the briber has Zerg Rush (double steps from any rank).
 */
function onBribableRank(state: GameState, color: Color, square: Square): boolean {
  const rank = Number(square[1]);
  const briber: Color = color === 'white' ? 'black' : 'white';
  if (affectsColor(state, MODIFIER_IDS.zergRush, briber)) return color === 'white' ? rank === 4 : rank === 5;
  return color === 'white' ? rank === 3 || rank === 4 : rank === 5 || rank === 6;
}

/** The board after the pawn on `square` joins `color`. */
function withBribe(state: GameState, square: Square, color: Color): GameState {
  const next = cloneState(state);
  const pawn = next.pieces.get(square)!;
  // Judged as a pawn even when Sus hides another type, so the check rule gives no disguise away.
  next.pieces.set(square, { ...pawn, type: 'pawn', color, cooldowns: {}, abilityCooldowns: {}, isTouched: false, isShielded: false, isTraitor: false });
  next.flags.enPassantSquare = null;
  // Camouflage: still-time does not carry over to the new owner.
  const camo = next.modifierState[MODIFIER_IDS.camouflage] as Record<string, unknown> | undefined;
  if (camo && camo[pawn.id]) {
    const rest = { ...camo };
    delete rest[pawn.id];
    next.modifierState = { ...next.modifierState, [MODIFIER_IDS.camouflage]: rest };
  }
  return next;
}

/** A Sus piece shown as a pawn turns the bribe down: the disguise drops and the move is spent. */
function refuseBribe(state: GameState, square: Square, queen: Piece): GameState {
  const piece = state.pieces.get(square)!;
  const next = cloneState(state);
  const sus = { ...((next.modifierState[MODIFIER_IDS.sus] as Record<string, unknown> | undefined) ?? {}) };
  delete sus[piece.color];
  next.modifierState = { ...next.modifierState, [MODIFIER_IDS.sus]: sus };
  next.flags.enPassantSquare = null;
  next.flags.halfMoveClock++;
  return appendGameEvent(next, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: MODIFIER_IDS.sus,
    title: 'Sus',
    message: `The ${queen.color} queen tries to bribe the pawn on ${square}. It was Sus: really a ${piece.color} ${piece.type.replace('_', ' ')}. It refuses.`,
    squares: [square],
  });
}

/**
 * Enemy pieces next to the Queen that look like pawns to her side (not a
 * Shell Game cup), in sight, on their own half, and whose switch puts no
 * King in check. A Sus piece shown as a pawn is offered too; the bribe then
 * fails and unmasks it (see refuseBribe), so the list gives nothing away.
 */
export function getBribes(state: GameState, queen: Piece): Square[] {
  const enemy: Color = queen.color === 'white' ? 'black' : 'white';
  const visible = getVisibleSquares(state, queen.color);
  const hidden = getHiddenPieceIds(state, queen.color);
  const out: Square[] = [];
  for (const [df, dr] of ALL_DIRECTIONS) {
    const sq = offset(queen.square, df, dr);
    if (!sq) continue;
    const pawn = state.pieces.get(sq);
    if (!pawn || pawn.color !== enemy || pawn.type === 'king' || pawn.isRealKing) continue;
    if ((visible && !visible.has(sq)) || hidden.has(pawn.id)) continue;
    if (getShownType(state, pawn, queen.color) !== 'pawn' || isCup(state, pawn, queen.color)) continue;
    if (!onBribableRank(state, enemy, sq)) continue;
    // A bribed pawn may not give check on the move it changes sides.
    if (isInCheck(withBribe(state, sq, queen.color), enemy)) continue;
    out.push(sq);
  }
  return out;
}

/** MOD-C019: the Queen bribes an adjacent enemy pawn on its own half to join her side. */
export const everyoneHasAPriceDef: ModifierDefinition = {
  id: ID,
  name: 'Everyone Has A Price',
  category: 'C',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Bribe',
    hint: 'Pick an enemy pawn next to the Queen, on its own half. It joins your side. Uses your move.',
    pieceTypes: ['queen'],
    entersTarget: false,
    cooldown: BRIBE_COOLDOWN,
    getTargets: (state, queen) => getBribes(state, queen),
    apply(state, move) {
      const queen = state.pieces.get(move.from)!;
      if (state.pieces.get(move.to)!.type !== 'pawn') return { state: refuseBribe(state, move.to, queen) };
      const next = withBribe(state, move.to, queen.color);
      next.flags.halfMoveClock = 0;
      const was = queen.color === 'white' ? 'black' : 'white';
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Everyone Has A Price',
          message: `The ${queen.color} queen bribes the ${was} pawn on ${move.to}. It joins ${queen.color}.`,
          squares: [move.to],
        }),
      };
    },
    notation: (_state, move) => `Q${move.from}$${move.to}`,
  },
};
