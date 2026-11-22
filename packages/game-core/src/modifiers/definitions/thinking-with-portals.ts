import type { ModifierDefinition } from '../types';
import type { GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { teleport } from '../../engine/teleport';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.thinkingWithPortals;

export const BLUE_PORTAL: Square = 'c4';
export const ORANGE_PORTAL: Square = 'f5';

/** The other end of a portal, or null if `square` is not a portal. */
export function portalExit(square: Square): Square | null {
  if (square === BLUE_PORTAL) return ORANGE_PORTAL;
  if (square === ORANGE_PORTAL) return BLUE_PORTAL;
  return null;
}

function side(color: string): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * MOD-A011: fixed portals on c4 (blue) and f5 (orange). A non-King piece
 * that ends its move on one steps out of the other, if that square is
 * empty. Uses the same jump as Vent Tiles (engine/teleport.ts), but a
 * portal never captures and never closes.
 */
export const thinkingWithPortalsDef: ModifierDefinition = {
  id: ID,
  name: 'Thinking With Portals',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const next = cloneState(state);
    for (const [sq, portal] of [[BLUE_PORTAL, 'blue'], [ORANGE_PORTAL, 'orange']] as const) {
      const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
      next.tiles.set(sq, { ...tile, portal });
    }
    return next;
  },

  onPostMove(state, move) {
    if (move.ability) return state;
    const exit = portalExit(move.to);
    if (!exit) return state;
    const piece = state.pieces.get(move.to);
    // The mover may already be gone (a vent, a capture chain): only the piece that moved here jumps.
    if (!piece || piece.color !== move.playerColor) return state;
    // Kings do not fit. An occupied or blocked exit, or a jump that exposes
    // the mover's own King, leaves the piece on the entry portal.
    const jump = teleport(state, move.to, exit, { capture: false });
    if (!jump) return state;
    const next: GameState = jump.state;
    // A pawn that double-stepped onto a portal is no longer where en passant would take it.
    if (next.flags.enPassantSquare) next.flags = { ...next.flags, enPassantSquare: null };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Portal',
      message: `${side(piece.color)}'s ${piece.type} steps through the portal from ${move.to} to ${exit}.`,
      squares: [move.to, exit],
    });
  },
};
