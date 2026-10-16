import type { ModifierDefinition } from '../types';
import type { Move, PieceType } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.reginaldBeak;

/** Generic reviews. The bible asks for 150+ lines in the end; this is the first batch. */
export const REGINALD_GENERAL_REVIEWS: readonly string[] = [
  '6/10. Predictable.',
  '9/10. Bold. Stupid, but bold.',
  '1/10. My grandmother could have done this and she is a pigeon.',
  '7/10. Too many pieces.',
  '5/10. It is a move. I will give it that.',
  '3/10. I have seen breadcrumbs with more vision.',
  '8/10. I did not hate it. Do not tell anyone.',
  '4/10. The board deserved better.',
  '2/10. I am writing this from the window ledge.',
  '6/10. Competent. Forgettable. Like most of my reviews.',
  '10/10. I am contractually required to give one of these.',
  '5/10. Mid. Extremely mid.',
  '7/10. Strong opening energy, weak follow-through.',
  '3/10. A bold choice from someone who did not think.',
  '8/10. That piece looks happy. That is not my job, but still.',
  '4/10. I have notes. All of them are coo.',
  '6/10. Fine. Moving on.',
  '2/10. Gerald would have done better and Gerald is a distraction.',
  '9/10. Cinema.',
  '5/10. It could have been worse. It could also have been better.',
];

const PIECE_REVIEWS: Partial<Record<PieceType, readonly string[]>> = {
  knight: ['4/10. Too much knight.', '7/10. The horse has a plan. The horse is alone in this.'],
  bishop: ['6/10. Diagonal. Very diagonal.', '5/10. The bishop prays this works.'],
  rook: ['6/10. A straight line. Daring.', '7/10. Castles should not move this much.'],
  queen: ['8/10. Bringing the queen out. Subtle as a bread truck.', '3/10. The queen is doing all the work again.'],
  king: ['2/10. The king should not be out here.', '5/10. Royalty, slumming it.'],
  pawn: ['5/10. A pawn moved. Riveting.', '6/10. Small step. Small review.'],
};

const SPECIAL_REVIEWS = {
  castle: '8/10. Hiding the king. Classic. Cowardly. Classic.',
  enPassant: '3/10. En passant. Look it up. I did. Still 3/10.',
  promotion: '9/10. Promotion. A pawn finally got a raise.',
  capture: '7/10. Violence. The crowd likes violence.',
} as const;

interface ReginaldState {
  capturedThisMove?: boolean;
}

function reviewPool(move: Move, movedType: PieceType | undefined, captured: boolean): readonly string[] {
  if (move.isCastle) return [SPECIAL_REVIEWS.castle];
  if (move.isEnPassant) return [SPECIAL_REVIEWS.enPassant];
  if (move.promotion) return [SPECIAL_REVIEWS.promotion];
  const pieceLines = (movedType && PIECE_REVIEWS[movedType]) ?? [];
  return [...REGINALD_GENERAL_REVIEWS, ...pieceLines, ...(captured ? [SPECIAL_REVIEWS.capture] : [])];
}

export const reginaldBeakDef: ModifierDefinition = {
  id: ID,
  name: '7/10 Too Many Pieces',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onCapture(state) {
    const next = cloneState(state);
    next.modifierState[ID] = { capturedThisMove: true } satisfies ReginaldState;
    return next;
  },

  onPostMove(state, move) {
    const captured = (state.modifierState[ID] as ReginaldState | undefined)?.capturedThisMove === true;
    let next = state;
    if (captured) {
      next = cloneState(state);
      next.modifierState[ID] = {} satisfies ReginaldState;
    }
    if (!affectsColor(state, ID, move.playerColor)) return next;

    const pool = reviewPool(move, state.pieces.get(move.to)?.type, captured);
    const [idx, nextPrng] = prngPickIndex(next.prngState, pool.length);
    const reviewed = cloneState(next);
    reviewed.prngState = nextPrng;
    return appendGameEvent(reviewed, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Reginald Beak',
      message: pool[idx],
    });
  },
};
