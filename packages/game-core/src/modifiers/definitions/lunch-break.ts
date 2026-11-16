import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, PieceType } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.lunchBreak;
/** Lunch comes after every this many of your moves. */
export const LUNCH_EVERY = 10;
/** The Chancellor replaced a rook (Equivalent Exchange), so it goes to lunch too. */
const LUNCH_TYPES = new Set<PieceType>(['rook', 'queen', 'chancellor']);
const REASON = 'Lunch Break: your rooks and Queen are at lunch. They cannot move this move.';

/** True when `color`'s current move is a lunch move (its 11th, 21st, ...). */
export function isLunchMove(state: GameState, color: Color): boolean {
  if (!affectsColor(state, ID, color)) return false;
  const n = ownMoveNumber(state, color);
  return n > LUNCH_EVERY && n % LUNCH_EVERY === 1;
}

/** True when lunch binds `color` this turn (not in check, and another piece can move). */
export function isAtLunch(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

function isLunchPiece(state: GameState, move: Move): boolean {
  // Castling moves a rook too.
  if (move.isCastle) return true;
  const type = state.pieces.get(move.from)?.type;
  return type !== undefined && LUNCH_TYPES.has(type);
}

registerMoveRule(ID, (state, color) =>
  isLunchMove(state, color)
    ? { allows: (s, move) => !isLunchPiece(s, move), reason: REASON, demand: false }
    : null,
);

/** MOD-B016 Lunch Break: every 10 of your moves, your rooks and Queen skip your next move. */
export const lunchBreakDef: ModifierDefinition = {
  id: ID,
  name: 'Lunch Break',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  // The sign goes up a round early, at the start of your 10th, 20th, ... move,
  // and the feed says so again when lunch starts.
  onTurnStart(state) {
    const color = state.turn;
    if (state.status !== 'active' || !affectsColor(state, ID, color)) return state;
    const n = ownMoveNumber(state, color);
    const sign = n % LUNCH_EVERY === 0;
    if (!sign && !isLunchMove(state, color)) return state;
    // beginTurn can run twice for one turn (a reload); post once.
    const posted = (state.modifierState[ID] as { signAt?: number } | undefined)?.signAt;
    if (posted === state.turnNumber) return state;
    const squares = Array.from(state.pieces.values())
      .filter(p => p.color === color && LUNCH_TYPES.has(p.type))
      .map(p => p.square);
    if (squares.length === 0) return state;
    const side = color === 'white' ? 'White' : 'Black';
    const next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { signAt: state.turnNumber } };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'LUNCH BREAK',
      message: sign
        ? `Lunch next move: ${side}'s rooks and Queen cannot move, use abilities or castle on ${side}'s next move. Cancelled in check or if nothing else can move.`
        : `${side}'s rooks and Queen are at lunch this move.`,
      squares,
    });
  },
};
