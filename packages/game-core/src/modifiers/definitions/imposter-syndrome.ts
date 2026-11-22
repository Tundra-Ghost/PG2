import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';
import { getSusPiece } from './sus';

const ID = MODIFIER_IDS.imposterSyndrome;
const REASON = 'Imposter Syndrome: your Queen doubts herself. She can only move one square.';

function distance(a: Square, b: Square): number {
  return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
}

/** True when the move is a doubting Queen trying to go further than one square. */
function isBigStep(state: GameState, move: Move): boolean {
  if (move.ability) return false;
  const piece = state.pieces.get(move.from);
  return piece?.type === 'queen' && piece.isDoubting === true && distance(move.from, move.to) > 1;
}

/** True when the doubt binds `color` this turn (not in check, and another move exists). */
export function isQueenDoubting(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

registerMoveRule(ID, (state, color) => {
  if (!affectsColor(state, ID, color)) return null;
  const doubting = Array.from(state.pieces.values()).some(p => p.color === color && p.type === 'queen' && p.isDoubting);
  return doubting ? { allows: (s, move) => !isBigStep(s, move), reason: REASON, demand: false } : null;
});

interface ImposterState {
  /** The piece making this move, found by id since other cards may move it. */
  mover?: string;
  /** The Queen that captured on this move; she keeps her doubt through onPostMove. */
  justCaptured?: string;
}

function read(state: GameState): ImposterState {
  return (state.modifierState[ID] as ImposterState | undefined) ?? {};
}

function findById(state: GameState, id: string | undefined) {
  if (!id) return undefined;
  for (const piece of state.pieces.values()) if (piece.id === id) return piece;
  return undefined;
}

/** MOD-B014: after your Queen captures, her next move can only be one square. */
export const imposterSyndromeDef: ModifierDefinition = {
  id: ID,
  name: 'Imposter Syndrome',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  // Remember who is moving, so later hooks find her even if another card
  // (a Berserker chain, a vent) has moved her off the target square.
  onPreMoveApply(state, move) {
    const mover = state.pieces.get(move.from);
    if (!mover) return { state, move };
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: { mover: mover.id } } }, move };
  },

  onCapture(state, move) {
    // A pawn that captures and promotes to a Queen was not a Queen when it captured.
    if (move.ability || move.promotion) return state;
    const queen = findById(state, read(state).mover);
    if (!queen || queen.type !== 'queen' || queen.color !== move.playerColor) return state;
    if (!affectsColor(state, ID, queen.color)) return state;
    const next = cloneState(state);
    next.pieces.set(queen.square, { ...queen, isDoubting: true });
    next.modifierState = { ...next.modifierState, [ID]: { ...read(state), justCaptured: queen.id } satisfies ImposterState };
    // Under Sus, a disguised Queen's doubt is never announced: it would give her away.
    if (getSusPiece(state, queen.color)?.pieceId === queen.id) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'IMPOSTER SYNDROME',
      message: `The ${queen.color} queen on ${queen.square} doubts herself. Her next move is only one square.`,
      squares: [queen.square],
    });
  },

  onPostMove(state, move) {
    const { mover: moverId, justCaptured } = read(state);
    if (!moverId && !justCaptured) return state;
    const next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: {} };
    if (move.ability) return next;
    const mover = findById(next, moverId);
    if (mover?.isDoubting && mover.id !== justCaptured) next.pieces.set(mover.square, { ...mover, isDoubting: false });
    return next;
  },
};
