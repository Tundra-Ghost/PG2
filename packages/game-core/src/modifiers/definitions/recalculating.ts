import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.recalculating;
const FILES = 'abcdefgh';
/** Fake dots appear within this many squares of the selected piece. */
const FAKE_RANGE = 3;

/**
 * MOD-D007: 1 or 2 fake move dots for the selected piece. They are picked
 * from the position and the square, so they stay put while the piece is
 * selected and change after every move. Real moves are never hidden.
 */
export function getFakeMoveHints(state: GameState, from: Square, real: readonly Square[]): Square[] {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return [];
  const piece = state.pieces.get(from);
  if (!piece) return [];
  const f0 = FILES.indexOf(from[0]);
  const r0 = Number(from[1]);
  const candidates: Square[] = [];
  for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
    if (Math.max(Math.abs(f - f0), Math.abs(r - r0)) > FAKE_RANGE) continue;
    const sq = `${FILES[f]}${r}` as Square;
    if (sq === from || real.includes(sq) || state.tiles.get(sq)?.isVoid) continue;
    if (state.pieces.get(sq)?.color === piece.color) continue;
    candidates.push(sq);
  }
  let seed = (state.prngState ^ (state.moveHistory.length * 7919) ^ (f0 * 131 + r0 * 17)) >>> 0;
  const [roll, afterRoll] = prngPickIndex(seed, 2);
  seed = afterRoll;
  const fakes: Square[] = [];
  for (let i = 0; i <= roll && candidates.length > 0; i++) {
    const [idx, next] = prngPickIndex(seed, candidates.length);
    seed = next;
    fakes.push(candidates.splice(idx, 1)[0]);
  }
  return fakes;
}

export const recalculatingDef: ModifierDefinition = {
  id: ID,
  name: 'Recalculating…',
  category: 'D',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',
};
