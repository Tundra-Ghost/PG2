import type { ModifierDefinition } from '../types';
import type { GameState, Piece } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.masquerade;

/** Masks are worn for rounds 1 to 6 and come off when round 7 starts. */
export const MASK_ROUNDS = 6;

function inPlay(state: GameState): boolean {
  return state.activeModifiers.some(mod => mod.id === ID);
}

/** True while the masks are on. */
export function isMasqueradeOn(state: GameState): boolean {
  return inPlay(state) && state.status === 'active' && state.flags.fullMoveNumber <= MASK_ROUNDS;
}

/**
 * True when this piece wears a mask: any piece still on the board but a
 * King, while the masks are on. A captured piece is shown as itself.
 */
export function isMasked(state: GameState, piece: Piece): boolean {
  if (!isMasqueradeOn(state) || piece.type === 'king' || piece.isRealKing) return false;
  // By id, so a move-list record of a piece still on the board is masked too.
  if (state.pieces.get(piece.square)?.id === piece.id) return true;
  for (const p of state.pieces.values()) if (p.id === piece.id) return true;
  return false;
}

/** The status chip: rounds left with masks on, or null. */
export function getMasks(state: GameState): string | null {
  if (!isMasqueradeOn(state)) return null;
  const left = MASK_ROUNDS + 1 - state.flags.fullMoveNumber;
  return left === 1 ? 'Masquerade: masks off next round' : `Masquerade: masks off in ${left} rounds`;
}

/**
 * MOD-D020: for the first 6 rounds every piece but the Kings wears the same
 * mask, for both players. Rules use true types. The opponent reads a masked
 * piece as a pawn wherever a type is needed (getShownType in sus.ts, bots,
 * online redaction), and the move list shows only the squares of masked
 * enemy moves. The board draws every masked piece as a mask; owners still
 * see their own pieces' real moves on select.
 */
export const masqueradeDef: ModifierDefinition = {
  id: ID,
  name: 'Masquerade',
  category: 'D',
  pointCost: 4,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    if (state.status !== 'active' || state.flags.fullMoveNumber <= MASK_ROUNDS) return state;
    if ((state.modifierState[ID] as { off?: boolean } | undefined)?.off) return state;
    const next: GameState = { ...state, modifierState: { ...state.modifierState, [ID]: { off: true } } };
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Masquerade',
      message: 'The masks come off. Every piece shows as itself again.',
    });
  },
};
