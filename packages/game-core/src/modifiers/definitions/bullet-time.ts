import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { isInCheck, isVoidSquare } from '../../engine/moveGenerator';
import { isStatueSquare } from '../../engine/statue';
import { getHiddenPieceIds, getVisibleSquares, withoutHiddenPieces } from '../../engine/visibility';
import { offset } from '../../engine/push';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.bulletTime;

const JUMPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const other = (color: Color): Color => (color === 'white' ? 'black' : 'white');

/** Knight jumps from `from` that stay on the board and off void squares (statue, storm, barriers). */
function jumps(state: GameState, from: Square): Square[] {
  return JUMPS.map(([df, dr]) => offset(from, df, dr)).filter((sq): sq is Square => sq !== null && !isVoidSquare(state, sq) && !isStatueSquare(state, sq));
}

/** The board with the knight moved, for the check test: only the pieces are copied. */
function withKnightOn(state: GameState, piece: Piece, mid: Square): GameState {
  const pieces = new Map(state.pieces);
  pieces.delete(piece.square);
  pieces.set(mid, { ...piece, square: mid });
  return { ...state, pieces };
}

/**
 * The squares a first jump may stop on: empty, in the mover's view (fog),
 * and with the knight there neither side is in check (no self-check, no
 * check from the first jump, discovered checks included).
 */
function firstJumps(state: GameState, piece: Piece): Square[] {
  const visible = getVisibleSquares(state, piece.color);
  return jumps(state, piece.square).filter(mid => {
    if (state.pieces.has(mid) || (visible && !visible.has(mid))) return false;
    const after = withKnightOn(state, piece, mid);
    return !isInCheck(after, piece.color) && !isInCheck(after, other(piece.color));
  });
}

/**
 * MOD-C016: the first jump the knight takes to reach `to`, or null. It is
 * picked on the board the mover sees (hidden pieces left out), the first that
 * works in a fixed order, so the client and the server agree. If a hidden
 * piece really stands there, the move fails on the real board and becomes a bump.
 */
export function bulletTimePath(state: GameState, from: Square, to: Square): Square | null {
  const piece = state.pieces.get(from);
  if (!piece) return null;
  const hidden = getHiddenPieceIds(state, piece.color);
  const view = hidden.size > 0 ? withoutHiddenPieces(state, piece.color, hidden) : state;
  const mid = firstJumps(view, piece).find(sq => jumps(view, sq).includes(to)) ?? null;
  if (!mid || view === state) return mid;
  return firstJumps(state, piece).includes(mid) ? mid : null;
}

/**
 * MOD-C016: a knight makes two jumps in one move. The first lands on an empty
 * square, never gives check and never leaves its own King in check. The
 * second may capture (and may give check). The ability flow picks the final
 * square; the first jump is the first one that works, in a fixed order, and
 * the move list shows it. Squares are only stopped on at the end, so tiles on
 * the first square do nothing.
 */
export const bulletTimeDef: ModifierDefinition = {
  id: ID,
  name: 'Bullet Time',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Bullet Time',
    hint: 'This knight jumps twice. The first jump cannot capture or give check. The second can capture.',
    pieceTypes: ['knight'],
    cooldown: 8,
    getTargets: (state, piece) => {
      const ends = new Set<Square>();
      for (const mid of firstJumps(state, piece)) for (const to of jumps(state, mid)) ends.add(to);
      return [...ends].filter(to => {
        if (to === piece.square) return false;
        const there = state.pieces.get(to);
        if (there && (there.color === piece.color || there.type === 'king')) return false;
        return bulletTimePath(state, piece.square, to) !== null;
      });
    },
    notation: (state, move) => {
      const mid = bulletTimePath(state, move.from, move.to);
      const capture = state.pieces.has(move.to) ? 'x' : '-';
      return `N${move.from}-${mid ?? '?'}${capture}${move.to}`;
    },
  },
};
