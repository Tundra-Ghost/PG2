import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { applyMoveInternal } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { offset } from '../../engine/push';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.bulletTime;

const JUMPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const other = (color: Color): Color => (color === 'white' ? 'black' : 'white');

function jumps(from: Square): Square[] {
  return JUMPS.map(([df, dr]) => offset(from, df, dr)).filter((sq): sq is Square => sq !== null);
}

/**
 * The squares a first jump may stop on: empty, and with the knight there
 * neither side is in check (no self-check, no check from the first jump,
 * discovered checks included).
 */
function firstJumps(state: GameState, piece: Piece): Square[] {
  return jumps(piece.square).filter(mid => {
    if (state.pieces.has(mid)) return false;
    const after = applyMoveInternal(state, { from: piece.square, to: mid, playerColor: piece.color });
    return !isInCheck(after, piece.color) && !isInCheck(after, other(piece.color));
  });
}

/** MOD-C016: the first jump the knight takes to reach `to`, in a fixed order, or null. */
export function bulletTimePath(state: GameState, from: Square, to: Square): Square | null {
  const piece = state.pieces.get(from);
  if (!piece) return null;
  return firstJumps(state, piece).find(mid => jumps(mid).includes(to)) ?? null;
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
      const targets = new Set<Square>();
      for (const mid of firstJumps(state, piece)) {
        for (const to of jumps(mid)) {
          if (to === piece.square) continue;
          const there = state.pieces.get(to);
          if (there && (there.color === piece.color || there.type === 'king')) continue;
          targets.add(to);
        }
      }
      return [...targets];
    },
    notation: (state, move) => {
      const mid = bulletTimePath(state, move.from, move.to);
      const capture = state.pieces.has(move.to) ? 'x' : '-';
      return `N${move.from}-${mid ?? '?'}${capture}${move.to}`;
    },
  },
};
