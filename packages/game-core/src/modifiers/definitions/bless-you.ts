import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, PieceType, Square } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.blessYou;
const FILES = 'abcdefgh';

/** Every this many rook, bishop or queen moves, the piece sneezes. */
export const SNEEZE_EVERY = 8;
const SLIDERS: PieceType[] = ['rook', 'bishop', 'queen'];

interface BlessState {
  /** Slider moves made so far, per owner. */
  count?: Partial<Record<Color, number>>;
  /** Set on the move being made: the slider's id, and where it meant to go if it sneezed. */
  mover?: string;
  sneezed?: { from: Square; meant: Square; stopped: Square };
}

function read(state: GameState): BlessState {
  return (state.modifierState[ID] as BlessState | undefined) ?? {};
}

/** Slider moves `color` must still make before the next sneeze: 1 means the next one sneezes. */
export function sneezeIn(state: GameState, color: Color): number | null {
  if (!affectsColor(state, ID, color)) return null;
  const made = read(state).count?.[color] ?? 0;
  return SNEEZE_EVERY - (made % SNEEZE_EVERY);
}

/** The square one step back along a straight line, or null for a one-square or non-line move. */
function oneShort(from: Square, to: Square): Square | null {
  const df = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
  const dr = Number(to[1]) - Number(from[1]);
  const n = Math.max(Math.abs(df), Math.abs(dr));
  if (n < 2) return null;
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return null;
  return `${FILES[FILES.indexOf(to[0]) - Math.sign(df)]}${Number(to[1]) - Math.sign(dr)}` as Square;
}

/**
 * MOD-B012: every 8th move its owner makes with a rook, bishop or queen,
 * the piece sneezes and stops one square short. The count runs per side
 * like the every-N counters of the scheduled curses (owner.ts), and the move
 * is rewritten before it is played, as Imposter Syndrome reads its Queen.
 */
export const blessYouDef: ModifierDefinition = {
  id: ID,
  name: 'Bless You',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  onPreMoveApply(state, move) {
    const piece = state.pieces.get(move.from);
    if (!piece || !SLIDERS.includes(piece.type) || piece.color !== move.playerColor) return { state, move };
    if (!affectsColor(state, ID, piece.color)) return { state, move };
    const mine = read(state);
    let next: BlessState = { ...mine, mover: piece.id, sneezed: undefined };
    let played: Move = move;
    if (sneezeIn(state, piece.color) === 1) {
      const stopped = oneShort(move.from, move.to);
      if (stopped) {
        const short: Move = { ...move, to: stopped };
        // Stopping short may never leave its own King in check; then the move happens in full.
        if (!isInCheck(applyMoveInternal(cloneState(state), short), piece.color)) {
          played = short;
          next = { ...next, sneezed: { from: move.from, meant: move.to, stopped } };
        }
      }
    }
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: next } }, move: played };
  },

  onPostMove(state, move) {
    const mine = read(state);
    if (!mine.mover) return state;
    const color = move.playerColor;
    const count = { ...mine.count, [color]: (mine.count?.[color] ?? 0) + 1 };
    let next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { count } satisfies BlessState };
    if (mine.sneezed) {
      const piece = next.pieces.get(mine.sneezed.stopped);
      next = appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'ACHOO',
        message: `${color === 'white' ? 'White' : 'Black'}'s ${piece?.type ?? 'piece'} sneezes and stops on ${mine.sneezed.stopped}, one square short of ${mine.sneezed.meant}.`,
        squares: [mine.sneezed.stopped, mine.sneezed.meant],
      });
    }
    return next;
  },
};
