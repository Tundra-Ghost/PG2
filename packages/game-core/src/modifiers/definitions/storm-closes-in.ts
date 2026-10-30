import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.stormClosesIn;
const FILES = 'abcdefgh';

/** Plies between storm waves: 8 full turns. */
export const STORM_WAVE_PLIES = 16;
/** Plies of warning before a wave lands. */
export const STORM_WARNING_PLIES = 4;
/** Waves 1-4 eat the outer ring from the corners inward, leaving 6x6. */
export const STORM_WAVES = 4;

/**
 * Outer-ring squares grouped by wave. A square's wave is its distance along
 * the edge from the nearest corner, plus one: corners go first, the middle of
 * each edge last.
 */
export function stormWave(square: Square): number | null {
  const f = FILES.indexOf(square[0]);
  const r = Number(square[1]) - 1;
  const onFileEdge = f === 0 || f === 7;
  const onRankEdge = r === 0 || r === 7;
  if (!onFileEdge && !onRankEdge) return null;
  const edgeDist = (i: number) => Math.min(i, 7 - i);
  if (onFileEdge && onRankEdge) return 1;
  return (onFileEdge ? edgeDist(r) : edgeDist(f)) + 1;
}

const RING: Square[] = (() => {
  const squares: Square[] = [];
  for (const f of FILES) for (let r = 1; r <= 8; r++) {
    const sq = `${f}${r}` as Square;
    if (stormWave(sq) !== null) squares.push(sq);
  }
  return squares;
})();

function wavesDue(plies: number): number {
  return Math.min(STORM_WAVES, Math.floor(plies / STORM_WAVE_PLIES));
}

export const stormClosesInDef: ModifierDefinition = {
  id: ID,
  name: 'The Storm Closes In',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onPostMove(state) {
    const plies = state.moveHistory.length + 1;
    const due = wavesDue(plies);
    const warnWave = wavesDue(plies + STORM_WARNING_PLIES) > due ? due + 1 : null;
    const mover = state.turn;

    const next = cloneState(state);
    const victims: string[] = [];
    const consumed: Square[] = [];

    for (const sq of RING) {
      const wave = stormWave(sq)!;
      const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
      if (tile.storm === 'active') continue;

      if (wave <= due) {
        const piece = next.pieces.get(sq);
        // Kings outlast the storm: their square is consumed once they leave.
        if (piece?.type === 'king') continue;
        const after = cloneState(next);
        after.pieces.delete(sq);
        after.tiles.set(sq, { ...tile, storm: 'active', isVoid: true });
        // Storm squares block lines, so this should never fire. Kept as a
        // guard: never strand the side that just moved in check.
        if (isInCheck(after, mover)) continue;
        if (piece) victims.push(`${piece.color} ${piece.type} on ${sq}`);
        consumed.push(sq);
        next.pieces.delete(sq);
        next.tiles.set(sq, after.tiles.get(sq)!);
      } else if (wave === warnWave && tile.storm !== 'warning') {
        next.tiles.set(sq, { ...tile, storm: 'warning' });
      }
    }

    if (consumed.length === 0) return next;
    return appendGameEvent(next, {
      ply: plies,
      type: 'modifier',
      modifierId: ID,
      title: 'Storm',
      squares: consumed,
      message:
        victims.length === 0
          ? 'The storm closes in.'
          : `The storm closes in. Lost: ${victims.join(', ')}.`,
    });
  },
};
