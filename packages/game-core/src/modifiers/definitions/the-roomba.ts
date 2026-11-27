import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isNewRound, revealBumped, shownSlideSquares, slidePieceSafely, type Bumped } from '../../engine/conveyor';
import { offset } from '../../engine/push';
import { prngPickIndex } from '../../engine/prng';
import { getHiddenPieceIds } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.theRoomba;

/** The outer ring, clockwise as White sees it: up the a-file, along rank 8, down the h-file, back along rank 1. */
export const ROOMBA_RING: Square[] = (() => {
  const ring: Square[] = [];
  for (let r = 1; r <= 8; r++) ring.push(`a${r}` as Square);
  for (const f of 'bcdefgh') ring.push(`${f}8` as Square);
  for (let r = 7; r >= 1; r--) ring.push(`h${r}` as Square);
  for (const f of 'gfedcb') ring.push(`${f}1` as Square);
  return ring;
})();

/** Where it may start: the middle of the side edges, one heading for each army. */
const STARTS: Square[] = ['a4', 'h5'];

interface RoombaState {
  at: Square;
  /** The round it last moved on, so a second onTurnStart is a no-op. */
  lastRound?: number;
}

/** The Roomba's square, or null without the card. */
export function getRoombaSquare(state: GameState): Square | null {
  return (state.modifierState[ID] as RoombaState | undefined)?.at ?? null;
}

/** The square a piece on the ring is pushed to: one step towards the centre (diagonal from a corner). */
export function inwardOf(sq: Square): Square {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const df = f === 0 ? 1 : f === 7 ? -1 : 0;
  const dr = r === 0 ? 1 : r === 7 ? -1 : 0;
  return offset(sq, df, dr)!;
}

/** The next square on the ring, clockwise. */
export function nextOnRing(sq: Square): Square {
  return ROOMBA_RING[(ROOMBA_RING.indexOf(sq) + 1) % ROOMBA_RING.length];
}

/**
 * MOD-A015: a robot vacuum goes clockwise round the outer ring, one square
 * per round, after Black moves. It never blocks a piece and is never taken.
 * When the next square holds a piece, it pushes that piece one square
 * inward and moves on. If the piece cannot go (blocked, or the push would
 * put a King in check: engine/conveyor.ts), or the next square is a wall,
 * flock or storm, it waits.
 */
export const theRoombaDef: ModifierDefinition = {
  id: ID,
  name: 'The Roomba',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    if (getRoombaSquare(state)) return state;
    const [idx, prngState] = prngPickIndex(state.prngState, STARTS.length);
    return { ...state, prngState, modifierState: { ...state.modifierState, [ID]: { at: STARTS[idx] } satisfies RoombaState } };
  },

  onTurnStart(state) {
    const roomba = state.modifierState[ID] as RoombaState | undefined;
    if (!roomba || !isNewRound(state, roomba.lastRound)) return state;
    let next = cloneState(state);
    const bumped: Bumped = new Set();
    const ahead = nextOnRing(roomba.at);
    const tile = next.tiles.get(ahead);
    let at = roomba.at;
    let pushed: Square | null = null;
    if (!tile?.isVoid) {
      const bumpee = next.pieces.get(ahead);
      // Bumping a hidden piece shows where it is, so it is revealed.
      if (bumpee && getHiddenPieceIds(next, bumpee.color === 'white' ? 'black' : 'white').has(bumpee.id)) bumped.add(bumpee.id);
      if (!bumpee) at = ahead;
      else if (slidePieceSafely(next, ahead, inwardOf(ahead), bumped)) {
        pushed = inwardOf(ahead);
        at = ahead;
      }
    }
    next.modifierState = { ...next.modifierState, [ID]: { at, lastRound: state.flags.fullMoveNumber } satisfies RoombaState };
    next = revealBumped(next, bumped);
    if (!pushed) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Roomba',
      message: `The Roomba bumps a piece inward from ${ahead}.`,
      squares: shownSlideSquares(next, [ahead, pushed]),
    });
  },
};
