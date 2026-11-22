import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { capturedIds } from '../captures';
import { timedPhase, type TimedPhase, type TimedSchedule } from '../timed';

const ID = MODIFIER_IDS.cropCircles;
const FILES = 'abcdefgh';

/** Every 8 rounds, for 3 rounds, shown 1 round ahead. */
export const CROP: TimedSchedule = { every: 16, stay: 6, warning: 2 };

interface CropState {
  phase: TimedPhase;
  squares: Square[];
}

/** Every 3x3 block inside ranks 3 to 6. */
const BLOCKS: Square[][] = (() => {
  const blocks: Square[][] = [];
  for (let f = 0; f <= 5; f++) {
    for (let r = 3; r <= 4; r++) {
      const block: Square[] = [];
      for (let df = 0; df < 3; df++) for (let dr = 0; dr < 3; dr++) block.push(`${FILES[f + df]}${r + dr}` as Square);
      blocks.push(block);
    }
  }
  return blocks;
})();

function read(state: GameState): CropState {
  return (state.modifierState[ID] as CropState | undefined) ?? { phase: null, squares: [] };
}

/** True while `square` is inside an active crop circle. */
export function isInCropCircle(state: GameState, square: Square): boolean {
  const crop = state.modifierState[ID] as CropState | undefined;
  return crop?.phase === 'active' && crop.squares.includes(square);
}

function setCircle(state: GameState, phase: TimedPhase, squares: Square[]): GameState {
  const next = cloneState(state);
  for (const sq of read(state).squares) {
    const tile = next.tiles.get(sq);
    if (!tile?.cropCircle) continue;
    const { cropCircle: _c, ...rest } = tile;
    const { square: _s, effects, ...flags } = rest;
    if (effects.length === 0 && !Object.values(flags).some(Boolean)) next.tiles.delete(sq);
    else next.tiles.set(sq, rest);
  }
  if (phase) {
    for (const sq of squares) {
      const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
      next.tiles.set(sq, { ...tile, cropCircle: phase });
    }
  }
  next.modifierState = { ...next.modifierState, [ID]: { phase, squares: phase ? squares : [] } satisfies CropState };
  return next;
}

/**
 * MOD-A019: every 8 rounds a 3x3 crop circle appears on ranks 3 to 6 for
 * 3 rounds, at a spot picked with the game seed and shown one round ahead
 * (the timed pattern of The Birds, modifiers/timed.ts). Pieces inside cannot
 * be captured (the check from Hold My Bread, modifiers/captures.ts). They
 * can still move and capture out of it. Check is never affected.
 */
export const cropCirclesDef: ModifierDefinition = {
  id: ID,
  name: 'Crop Circles',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    const phase = timedPhase(state.turnNumber, CROP);
    const was = read(state);
    if (phase === was.phase) return state;
    let squares = was.squares;
    let prngState = state.prngState;
    if (phase === 'warning' || (phase === 'active' && squares.length === 0)) {
      let idx: number;
      [idx, prngState] = prngPickIndex(state.prngState, BLOCKS.length);
      squares = BLOCKS[idx];
    }
    const next = setCircle({ ...state, prngState }, phase, squares);
    const corners = `${squares[0]} to ${squares[squares.length - 1]}`;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Crop Circles',
      message: phase === 'warning'
        ? `Strange lights over ${corners}. A crop circle appears there next round.`
        : phase === 'active'
          ? `A crop circle covers ${corners}. Pieces inside cannot be captured for 3 rounds.`
          : 'The crop circle fades.',
      squares: phase ? squares : was.squares,
    });
  },

  onPreMoveValidate(state, move) {
    const crop = read(state);
    if (crop.phase !== 'active') return { blocked: false };
    const inside = new Set<string>();
    for (const sq of crop.squares) {
      const piece = state.pieces.get(sq);
      if (piece) inside.add(piece.id);
    }
    if (inside.size === 0) return { blocked: false };
    if (capturedIds(state, move).some(id => inside.has(id))) {
      return { blocked: true, reason: 'Crop Circles: pieces inside the circle cannot be captured.' };
    }
    return { blocked: false };
  },
};
