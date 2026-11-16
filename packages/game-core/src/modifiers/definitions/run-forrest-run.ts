import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, cloneState } from '../../engine/gameLoop';
import { isInCheck, isVoidSquare } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.runForrestRun;

/** Own turns the King waits after a run. */
export const RUN_COOLDOWN = 10;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function offset(sq: Square, df: number, dr: number): Square | null {
  const f = sq.charCodeAt(0) - 97 + df;
  const r = Number(sq[1]) - 1 + dr;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}

function open(state: GameState, sq: Square): boolean {
  return !state.pieces.has(sq) && !isVoidSquare(state, sq);
}

/** True when the King standing on `sq` would be in check. */
function attackedFor(state: GameState, king: Piece, sq: Square): boolean {
  const probe = cloneState(state);
  probe.pieces.delete(king.square);
  probe.pieces.set(sq, { ...king, square: sq });
  return isInCheck(probe, king.color);
}

/**
 * Squares two steps away in a straight line, where both squares are empty
 * and the middle one is not attacked. The engine rejects an end square that
 * leaves the King in check.
 */
export function getRunTargets(state: GameState, king: Piece): Square[] {
  const targets: Square[] = [];
  for (const [df, dr] of DIRECTIONS) {
    const mid = offset(king.square, df, dr);
    const end = offset(king.square, 2 * df, 2 * dr);
    if (!mid || !end || !open(state, mid) || !open(state, end)) continue;
    if (attackedFor(state, king, mid)) continue;
    targets.push(end);
  }
  return targets;
}

/** MOD-C014: the King runs two squares in a straight line. No capture. */
export const runForrestRunDef: ModifierDefinition = {
  id: ID,
  name: 'Run, Forrest, Run',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Run',
    hint: 'Your King runs two squares in a straight line. Both squares must be empty and safe.',
    pieceTypes: ['king'],
    cooldown: RUN_COOLDOWN,
    getTargets: getRunTargets,
    apply(state, move) {
      const king = state.pieces.get(move.from)!;
      const next = applyMoveInternal(state, { from: move.from, to: move.to, playerColor: move.playerColor });
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'RUN, FORREST, RUN',
          message: `The ${king.color} king runs from ${move.from} to ${move.to}.`,
          squares: [move.from, move.to],
        }),
      };
    },
  },
};
