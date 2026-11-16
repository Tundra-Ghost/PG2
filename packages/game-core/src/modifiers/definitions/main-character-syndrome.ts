import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.mainCharacterSyndrome;
/** The Queen must act at least once in every this many of your moves. */
export const QUEEN_EVERY = 4;
const REASON = 'Main Character Syndrome: your Queen has waited long enough. Move her.';

interface McsState {
  /** Your move number when your Queen last moved (0 = not yet). */
  last: Partial<Record<Color, number>>;
  /** True once your Queen is gone. The curse is over for good. */
  ended: Partial<Record<Color, boolean>>;
  /** Where the side to move had its queens when its turn began. */
  start?: { turnNumber: number; color: Color; squares: Square[] };
}

function read(state: GameState): McsState {
  const raw = state.modifierState[ID] as McsState | undefined;
  return raw ?? { last: {}, ended: {} };
}

function write(state: GameState, value: McsState): GameState {
  const next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: value };
  return next;
}

function queenSquares(state: GameState, color: Color): Square[] {
  const squares: Square[] = [];
  for (const piece of state.pieces.values()) {
    if (piece.color === color && piece.type === 'queen') squares.push(piece.square);
  }
  return squares;
}

/** Your own moves in a row without a Queen move, counting this one. */
function waitingMoves(state: GameState, color: Color): number {
  return ownMoveNumber(state) - (read(state).last[color] ?? 0);
}

/** True when `color`'s Queen is owed a move now, before check and "if she can". */
export function isQueenDemanded(state: GameState, color: Color): boolean {
  if (!affectsColor(state, ID, color) || read(state).ended[color]) return false;
  if (queenSquares(state, color).length === 0) return false;
  return waitingMoves(state, color) >= QUEEN_EVERY;
}

/** True when the side must move its Queen this turn (not in check and she has a move). */
export function mustMoveQueen(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

registerMoveRule(ID, (state, color) => {
  if (!isQueenDemanded(state, color)) return null;
  return {
    allows: (s, move) => {
      const piece = s.pieces.get(move.from);
      return piece?.type === 'queen' && piece.color === move.playerColor;
    },
    reason: REASON,
    demand: true,
  };
});

function label(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

/** MOD-B010 Main Character Syndrome: your Queen must move at least once every 4 of your moves. */
export const mainCharacterSyndromeDef: ModifierDefinition = {
  id: ID,
  name: 'Main Character Syndrome',
  category: 'B',
  pointCost: -1,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  onTurnStart(state) {
    const color = state.turn;
    if (!affectsColor(state, ID, color)) return state;
    const current = read(state);
    const squares = queenSquares(state, color);
    const ended = current.ended[color] || squares.length === 0;
    return write(state, {
      ...current,
      ended: ended ? { ...current.ended, [color]: true } : current.ended,
      start: { turnNumber: state.turnNumber, color, squares },
    });
  },

  onPostMove(state, move) {
    const color = move.playerColor;
    if (!affectsColor(state, ID, color)) return state;
    const current = read(state);
    if (current.ended[color]) return state;
    const start = current.start;
    // The snapshot from the start of this turn says which piece acted, even for
    // abilities that leave the Queen where she was or swap her with another piece.
    const queenActed = start && start.turnNumber === state.turnNumber && start.color === color
      ? start.squares.includes(move.from)
      : !move.ability && !move.promotion && state.pieces.get(move.to)?.type === 'queen';
    if (queenActed) {
      return write(state, { ...current, last: { ...current.last, [color]: ownMoveNumber(state) } });
    }
    if (waitingMoves(state, color) !== QUEEN_EVERY - 1 || queenSquares(state, color).length === 0) return state;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'MAIN CHARACTER',
      message: `${label(color)}'s Queen has sat out ${QUEEN_EVERY - 1} moves. Her next move is not optional.`,
      squares: queenSquares(state, color),
    });
  },
};
