import type { ModifierDefinition } from '../types';
import type { GameState, Move, Piece, Square } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, buildMove, cloneState } from '../../engine/gameLoop';
import { isInCheck, isVoidSquare } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.twinTelepathy;
const FILES = 'abcdefgh';

function step(square: Square, df: number, dr: number, n: number): Square | null {
  const f = FILES.indexOf(square[0]) + df * n;
  const r = Number(square[1]) + dr * n;
  if (f < 0 || f > 7 || r < 1 || r > 8) return null;
  return `${FILES[f]}${r}` as Square;
}

/**
 * The farthest square, up to `distance` steps along (df, dr), that the twin
 * can reach without capturing and without leaving its own king in check.
 */
function mirrorTarget(state: GameState, twin: Piece, df: number, dr: number, distance: number): Square | null {
  let reachable = 0;
  for (let n = 1; n <= distance; n++) {
    const sq = step(twin.square, df, dr, n);
    if (!sq || state.pieces.has(sq) || isVoidSquare(state, sq)) break;
    reachable = n;
  }
  for (let n = reachable; n >= 1; n--) {
    const to = step(twin.square, df, dr, n)!;
    const after = applyMoveInternal(state, buildMove(state, twin.square, to));
    if (!isInCheck(after, twin.color)) return to;
  }
  return null;
}

export const twinTelepathyDef: ModifierDefinition = {
  id: ID,
  name: 'Twin Telepathy',
  category: 'E',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onPostMove(state, move: Move) {
    const bishop = state.pieces.get(move.to);
    if (!bishop || bishop.type !== 'bishop') return state;

    const df = Math.sign(FILES.indexOf(move.to[0]) - FILES.indexOf(move.from[0]));
    const dr = Math.sign(Number(move.to[1]) - Number(move.from[1]));
    const distance = Math.abs(Number(move.to[1]) - Number(move.from[1]));
    if (df === 0 || dr === 0) return state;

    let next = state;
    const twins = Array.from(state.pieces.values()).filter(
      p => p.type === 'bishop' && p.color === bishop.color && p.id !== bishop.id,
    );
    for (const twin of twins) {
      // A blocked twin (Gerald, frozen, swamp-stuck) stays put.
      if (Object.values(twin.cooldowns).some(cd => cd > 0)) continue;
      const to = mirrorTarget(next, twin, df, dr, distance);
      if (!to) continue;
      const from = twin.square;
      next = applyMoveInternal(cloneState(next), buildMove(next, from, to));
      // The twin's slide is not a pawn move or capture, but it is not the
      // player's move either: keep the 50-move clock from the real move.
      next.flags.halfMoveClock = state.flags.halfMoveClock;
      next.flags.enPassantSquare = state.flags.enPassantSquare;
      next = appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'Twin Telepathy',
        message: `The ${twin.color} twin bishop mirrors ${from} to ${to}.`,
      });
    }
    return next;
  },
};
