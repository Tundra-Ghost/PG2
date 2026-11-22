import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { canHoldBarrier, cutsOffAKing, getBarriers, liftExpiredBarriers, placeBarriers } from '../../engine/barriers';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.theBirds;
const FILES = 'abcdefgh';

/** Plies between landings: 6 rounds. */
export const FLOCK_INTERVAL_PLIES = 12;
/** Plies a flock stays: 2 rounds. */
export const FLOCK_STAY_PLIES = 4;
/** Plies of warning before it lands: 1 round. */
export const FLOCK_WARNING_PLIES = 2;

interface BirdsState {
  /** Where the next flock lands, shown to both players. */
  next: Square[];
  /** The turnNumber it lands on, so a second onTurnStart call is a no-op. */
  landsAt?: number;
}

/** Every 2x2 block whose squares are all on ranks 3 to 6. */
const BLOCKS: Square[][] = (() => {
  const blocks: Square[][] = [];
  for (let f = 0; f < 7; f++) {
    for (let r = 3; r <= 5; r++) {
      const a = FILES[f];
      const b = FILES[f + 1];
      blocks.push([`${a}${r}`, `${b}${r}`, `${a}${r + 1}`, `${b}${r + 1}`] as Square[]);
    }
  }
  return blocks;
})();

/** The squares the next flock lands on. Empty without the card or between warnings. */
export function getFlockPreview(state: GameState): Square[] {
  return (state.modifierState[ID] as BirdsState | undefined)?.next ?? [];
}

function isOpenBlock(state: GameState, block: Square[]): boolean {
  return block.every(sq => canHoldBarrier(state, sq)) && !cutsOffAKing(state, block);
}

/** A random open block with the seeded generator, or null if none is open. */
function pickBlock(state: GameState): [Square[] | null, number] {
  const open = BLOCKS.filter(block => isOpenBlock(state, block));
  if (open.length === 0) return [null, state.prngState];
  const [idx, prngState] = prngPickIndex(state.prngState, open.length);
  return [open[idx], prngState];
}

function setPreview(state: GameState, next: Square[], landsAt?: number): GameState {
  const result = cloneState(state);
  for (const [sq, tile] of result.tiles) {
    if (tile.flockWarning) {
      const { flockWarning: _w, ...rest } = tile;
      const { square: _s, effects, ...flags } = rest;
      if (effects.length === 0 && !Object.values(flags).some(Boolean)) result.tiles.delete(sq);
      else result.tiles.set(sq, rest);
    }
  }
  for (const sq of next) {
    const tile = result.tiles.get(sq) ?? { square: sq, effects: [] };
    result.tiles.set(sq, { ...tile, flockWarning: true });
  }
  result.modifierState = { ...result.modifierState, [ID]: { next, ...(landsAt ? { landsAt } : {}) } satisfies BirdsState };
  return result;
}

/** A landing turn: 13, 25, 37, ... (every 6 rounds after the start). */
function isLandingTurn(turnNumber: number): boolean {
  return turnNumber > 1 && (turnNumber - 1) % FLOCK_INTERVAL_PLIES === 0;
}

/**
 * MOD-A009: every 6 rounds a flock lands on a random empty 2x2 area of ranks
 * 3 to 6 and blocks it for 2 rounds, like a Dirt Hut wall (engine/barriers.ts).
 * The spot is shown one round ahead. If a piece moves into it in the
 * meantime, the flock picks another open spot when it lands.
 */
export const theBirdsDef: ModifierDefinition = {
  id: ID,
  name: 'The Birds (Hitchcock Mode)',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    let next = state;
    const ply = state.moveHistory.length + 1;

    const lifted = liftExpiredBarriers(next, 'flock');
    if (lifted.lifted.length > 0) {
      next = appendGameEvent(lifted.state, {
        ply,
        type: 'modifier',
        modifierId: ID,
        title: 'The Birds',
        message: 'The flock flies off.',
        squares: lifted.lifted,
      });
    }

    const landsAt = next.turnNumber + FLOCK_WARNING_PLIES;
    const birds = next.modifierState[ID] as BirdsState | undefined;
    const alreadyLanded = getBarriers(next, 'flock').some(b => b.barrier.until === next.turnNumber + FLOCK_STAY_PLIES);
    if (isLandingTurn(landsAt) && birds?.landsAt !== landsAt) {
      const [block, prngState] = pickBlock(next);
      next = setPreview({ ...next, prngState }, block ?? [], landsAt);
      if (block) {
        next = appendGameEvent(next, {
          ply,
          type: 'modifier',
          modifierId: ID,
          title: 'The Birds',
          message: `A flock circles over ${block[0]} to ${block[3]}. It lands next round.`,
          squares: block,
        });
      }
    } else if (isLandingTurn(next.turnNumber) && !alreadyLanded) {
      let block: Square[] | null = getFlockPreview(next);
      let prngState = next.prngState;
      if (block.length === 0 || !isOpenBlock(next, block)) [block, prngState] = pickBlock(next);
      next = setPreview({ ...next, prngState }, []);
      if (block) {
        next = cloneState(next);
        placeBarriers(next, block, { kind: 'flock', until: next.turnNumber + FLOCK_STAY_PLIES });
        next = appendGameEvent(next, {
          ply,
          type: 'modifier',
          modifierId: ID,
          title: 'The Birds',
          message: `The flock lands on ${block[0]} to ${block[3]}. Nothing can land on or cross it for 2 rounds.`,
          squares: block,
        });
      }
    }
    return next;
  },
};
