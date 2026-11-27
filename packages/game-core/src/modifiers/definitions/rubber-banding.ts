import type { ModifierDefinition } from '../types';
import type { CastlingRights, Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { capturedIds } from '../captures';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.rubberBanding;
/** Every this many of your moves, one lags. */
export const LAG_EVERY = 7;

interface PendingLag {
  pieceId: string;
  from: Square;
  castlingRights: CastlingRights;
  halfMoveClock: number;
}

interface LagState {
  /** Lags already spent, per side. */
  lagged?: Partial<Record<Color, number>>;
  /** Set by onPreMoveApply for the move being played, cleared by onPostMove. */
  pending?: PendingLag;
}

function read(state: GameState): LagState {
  return (state.modifierState[ID] as LagState | undefined) ?? {};
}

/**
 * True when `color`'s move now is due to lag: its 7th, 14th, ... move, or a
 * later one if that move could not lag (the every-N counter of Death And
 * Taxes, modifiers/owner.ts). A lag that cannot happen waits; it is never lost.
 */
export function isLagDue(state: GameState, color: Color): boolean {
  if (!affectsColor(state, ID, color)) return false;
  return Math.floor(ownMoveNumber(state, color) / LAG_EVERY) > (read(state).lagged?.[color] ?? 0);
}

/** The ping counter: own moves until `color`'s next lag, 0 meaning this move. Null without the card. */
export function movesUntilLag(state: GameState, color: Color): number | null {
  if (!affectsColor(state, ID, color)) return null;
  if (isLagDue(state, color)) return 0;
  const next = ((read(state).lagged?.[color] ?? 0) + 1) * LAG_EVERY;
  return Math.max(1, next - ownMoveNumber(state, color));
}

function side(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * MOD-B018: every 7th move of the owner lags. The piece moves, then snaps
 * back to where it started; the turn still passes. Captures, castling,
 * promotions, abilities and moves made in check never lag: the lag waits for
 * the next move that can. A snap that would leave the owner's King in check
 * does not happen either.
 */
export const rubberBandingDef: ModifierDefinition = {
  id: ID,
  name: 'Rubber Banding',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',
  // Snap after every other card has seen the move land (mines, vents, portals).
  postMoveLast: true,

  // Abilities skip onPreMoveApply, so they never lag.
  onPreMoveApply(state, move) {
    const color = move.playerColor;
    if (!isLagDue(state, color)) return { state, move };
    if (move.isCastle || move.promotion || isInCheck(state, color)) return { state, move };
    if (capturedIds(state, move).length > 0) return { state, move };
    const piece = state.pieces.get(move.from);
    if (!piece) return { state, move };
    const pending: PendingLag = {
      pieceId: piece.id,
      from: move.from,
      castlingRights: state.flags.castlingRights[color],
      halfMoveClock: state.flags.halfMoveClock,
    };
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: { ...read(state), pending } } }, move };
  },

  onPostMove(state, move) {
    const mine = read(state);
    const pending = mine.pending;
    if (!pending) return state;
    const color = move.playerColor;
    let next = cloneState(state);
    next.modifierState = { ...next.modifierState, [ID]: { lagged: mine.lagged } satisfies LagState };
    const piece = next.pieces.get(move.to);
    // Something else moved or removed it on the way (a vent, lava, a mine): no snap, the lag waits.
    if (!piece || piece.id !== pending.pieceId || next.pieces.has(pending.from)) return next;
    const snapped = cloneState(next);
    snapped.pieces.delete(move.to);
    snapped.pieces.set(pending.from, { ...piece, square: pending.from });
    if (isInCheck(snapped, color)) return next;
    // The piece never really left: castling rights come back and a double step gives no en passant.
    // Only the mover's rights: another card may have changed the other side's this move.
    snapped.flags = {
      ...snapped.flags,
      castlingRights: { ...snapped.flags.castlingRights, [color]: pending.castlingRights },
      enPassantSquare: null,
      halfMoveClock: pending.halfMoveClock + 1,
    };
    snapped.modifierState = { ...snapped.modifierState, [ID]: { lagged: { ...mine.lagged, [color]: (mine.lagged?.[color] ?? 0) + 1 } } satisfies LagState };
    // Named as the opponent sees it (Sus, Shell Game), so the feed never gives a disguise away.
    const shownAs = getShownType(state, piece, color === 'white' ? 'black' : 'white');
    next = appendGameEvent(snapped, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'LAG',
      message: `${side(color)}'s ${shownAs} went to ${move.to}, then snapped back to ${pending.from}. The turn still passes.`,
      squares: [pending.from, move.to],
    });
    return next;
  },
};
