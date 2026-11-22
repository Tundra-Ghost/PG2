import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { canMovePieceTo, offset, shiftPiece } from '../../engine/push';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.mine;
/** The seagull comes after every this many of your moves. */
export const SEAGULL_EVERY = 8;

/** How far a pawn has walked from its own side: 0 on rank 1/8, 7 on the far rank. */
function progress(pawn: Piece): number {
  const rank = Number(pawn.square[1]);
  return pawn.color === 'white' ? rank - 1 : 8 - rank;
}

/**
 * The pawn the seagull takes and where it lands, or null. The most advanced
 * pawn goes one square back toward its own side, if that square is empty,
 * not Lava, void or the back rank, and the move does not expose its King.
 * Ties go to the pawn nearest the a-file, so the choice needs no dice.
 * Pawns are what the opponent sees (Sus), so a disguise is never given away.
 */
export function getSeagullTarget(state: GameState, color: Color): { from: Square; to: Square } | null {
  // Rank what the opponent sees as pawns. If the lead one is a Sus fake,
  // the seagull does nothing, so its choice never gives a disguise away.
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const shown = Array.from(state.pieces.values())
    .filter(p => p.color === color && getShownType(state, p, opponent) === 'pawn')
    .sort((a, b) => progress(b) - progress(a) || a.square.localeCompare(b.square));
  const pawn = shown[0];
  if (!pawn || pawn.type !== 'pawn') return null;
  const back = offset(pawn.square, 0, color === 'white' ? -1 : 1);
  if (!canMovePieceTo(state, pawn, back)) return null;
  const after = cloneState(state);
  shiftPiece(after, pawn.square, back);
  if (isInCheck(after, color)) return null;
  return { from: pawn.square, to: back };
}

/** MOD-B017: every 8 of your moves, a seagull carries your most advanced pawn one square back. */
export const mineDef: ModifierDefinition = {
  id: ID,
  name: 'MINE!',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',

  // After your 8th, 16th, ... move. The move counter has not ticked yet, so
  // ownMoveNumber is the move just made. A pass runs no onPostMove, so a
  // seagull due on a pass comes on your next real move instead: passing
  // (shooing Gerald) never dodges it.
  onPostMove(state, move) {
    const color = move.playerColor;
    if (state.status !== 'active' || !affectsColor(state, ID, color)) return state;
    const cycle = Math.floor(ownMoveNumber(state, color) / SEAGULL_EVERY);
    const fired = (state.modifierState[ID] as Partial<Record<Color, number>> | undefined) ?? {};
    if (cycle <= (fired[color] ?? 0)) return state;
    const marked = cloneState(state);
    marked.modifierState = { ...marked.modifierState, [ID]: { ...fired, [color]: cycle } };
    state = marked;
    const target = getSeagullTarget(state, color);
    const ply = state.moveHistory.length + 1;
    if (!target) {
      return appendGameEvent(state, {
        ply, type: 'modifier', modifierId: ID, title: 'MINE!',
        message: 'The seagull circles, finds nothing it can carry, and leaves.',
      });
    }
    const next = cloneState(state);
    shiftPiece(next, target.from, target.to);
    // A pawn carried back after a double step can no longer be taken en passant.
    if (next.flags.enPassantSquare) next.flags = { ...next.flags, enPassantSquare: null };
    return appendGameEvent(next, {
      ply, type: 'modifier', modifierId: ID, title: 'MINE!',
      message: `A seagull carries the ${color} pawn from ${target.from} back to ${target.to}.`,
      squares: [target.from, target.to],
    });
  },
};
