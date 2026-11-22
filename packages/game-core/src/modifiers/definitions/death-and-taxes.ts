import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.deathAndTaxes;
/** The tax is collected after every this many of your moves. */
export const TAX_EVERY = 10;

/** How far a pawn has walked from its own side. */
function progress(pawn: Piece): number {
  const rank = Number(pawn.square[1]);
  return pawn.color === 'white' ? rank - 1 : 8 - rank;
}

/**
 * The pawn the tax office takes: the one furthest back, nearest the a-file
 * on a tie, skipping any whose removal would leave its King in check.
 * "Pawn" is what the opponent sees (Sus): a piece disguised as a pawn is
 * taxed like one, and a disguised pawn is never taken, so no disguise leaks.
 */
export function getTaxedPawn(state: GameState, color: Color): Square | null {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const pawns = Array.from(state.pieces.values())
    .filter(p => p.color === color && getShownType(state, p, opponent) === 'pawn')
    .sort((a, b) => progress(a) - progress(b) || a.square.localeCompare(b.square));
  for (const pawn of pawns) {
    const after = cloneState(state);
    after.pieces.delete(pawn.square);
    if (isInCheck(after, color)) continue;
    return pawn.square;
  }
  return null;
}

/** Tax cycles already collected, per side. */
function collected(state: GameState): Partial<Record<Color, number>> {
  return (state.modifierState[ID] as { collected?: Partial<Record<Color, number>> } | undefined)?.collected ?? {};
}

/**
 * True when a tax is due after the move `color` makes now: its 10th, 20th,
 * ... move, or the first real move after one that was a pass (a pass runs
 * no onPostMove, so passing never dodges the tax).
 */
export function isTaxMove(state: GameState, color: Color): boolean {
  if (!affectsColor(state, ID, color)) return false;
  return Math.floor(ownMoveNumber(state, color) / TAX_EVERY) > (collected(state)[color] ?? 0);
}

function side(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * MOD-B013: after every 10 of your moves the tax office removes your
 * rearmost pawn. The feed warns at the start of that move. Once you have no
 * pawns, nothing more is taken.
 */
export const deathAndTaxesDef: ModifierDefinition = {
  id: ID,
  name: 'Death And Taxes',
  category: 'B',
  pointCost: -3,
  curseRating: 3,
  activeFor: 'both',
  draftScope: 'owned',

  // The warning: at the start of your 10th, 20th, ... move.
  onTurnStart(state) {
    const color = state.turn;
    if (state.status !== 'active' || !isTaxMove(state, color)) return state;
    // beginTurn can run twice for one turn (a reload); warn once.
    const mine = state.modifierState[ID] as { warnedAt?: number } | undefined;
    if (mine?.warnedAt === state.turnNumber) return state;
    // Always warn on tax day, even with nothing to take yet: the tax may
    // still be taken from the board as it stands after the move.
    // Once you have no pawns (as the opponent sees them) the curse is over.
    const opponent: Color = color === 'white' ? 'black' : 'white';
    const hasPawns = Array.from(state.pieces.values()).some(p => p.color === color && getShownType(state, p, opponent) === 'pawn');
    if (!hasPawns) return state;
    const pawn = getTaxedPawn(state, color);
    const next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { ...mine, warnedAt: state.turnNumber } };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'TAX DAY',
      message: pawn
        ? `After this move the tax office takes ${side(color)}'s rearmost pawn (now ${pawn}).`
        : `After this move the tax office takes ${side(color)}'s rearmost pawn, if one can be taken.`,
      ...(pawn ? { squares: [pawn] } : {}),
    });
  },

  // The collection: right after that move, from the board as it now stands.
  onPostMove(state, move) {
    const color = move.playerColor;
    if (state.status !== 'active' || !isTaxMove(state, color)) return state;
    const next = cloneState(state);
    const mine = (state.modifierState[ID] as object | undefined) ?? {};
    const cycle = Math.floor(ownMoveNumber(state, color) / TAX_EVERY);
    next.modifierState = { ...next.modifierState, [ID]: { ...mine, collected: { ...collected(state), [color]: cycle } } };
    const pawn = getTaxedPawn(state, color);
    if (!pawn) return next;
    next.pieces.delete(pawn);
    // A taxed pawn that just double-stepped can no longer be taken en passant.
    if (next.flags.enPassantSquare) next.flags = { ...next.flags, enPassantSquare: null };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'TAXED',
      message: `The tax office collects ${side(color)}'s pawn on ${pawn}.`,
      squares: [pawn],
    });
  },
};
