import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { ALL_DIRECTIONS, canMovePieceTo, offset, shiftPiece } from '../../engine/push';
import { getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { isQuietZoneClosedTo } from './quiet-quitting';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.getOverHere;

/** Own turns the Queen waits after a pull. */
export const PULL_COOLDOWN = 8;

/**
 * For each of the Queen's 8 lines, the first piece on it, if it is an enemy
 * (not a King) at least two squares away, with the square next to the Queen
 * it is pulled to. Void squares (storm, statue, used vents) end a line. The
 * landing square may not be Lava (the pull never captures), and a pawn is
 * never pulled onto rank 1 or 8. Under fog the whole line up to the piece
 * must be in view, so the button reveals nothing.
 */
export function getPulls(state: GameState, queen: Piece): { from: Square; to: Square }[] {
  const pulls: { from: Square; to: Square }[] = [];
  const visible = getVisibleSquares(state, queen.color);
  for (const [df, dr] of ALL_DIRECTIONS) {
    const landing = offset(queen.square, df, dr);
    let sq = landing;
    let hidden = false;
    while (sq && !state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid) {
      if (visible && !visible.has(sq)) hidden = true;
      sq = offset(sq, df, dr);
    }
    if (!sq || !landing || sq === landing || hidden) continue;
    const piece = state.pieces.get(sq);
    if (!piece || piece.color === queen.color || piece.type === 'king') continue;
    if (visible && !visible.has(sq)) continue;
    const shownType = getShownType(state, piece, queen.color);
    if (landing && isQuietZoneClosedTo(state, landing, piece.color)) continue;
    if (canMovePieceTo(state, piece, landing, { shownType })) pulls.push({ from: sq, to: landing });
  }
  return pulls;
}

/** MOD-C011: the Queen pulls the first enemy piece on one of her lines next to her. */
export const getOverHereDef: ModifierDefinition = {
  id: ID,
  name: 'GET OVER HERE!',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Get over here',
    hint: 'Pick the first enemy piece on one of the Queen\'s lines (not the King). It is pulled to the square next to her.',
    pieceTypes: ['queen'],
    entersTarget: false,
    cooldown: PULL_COOLDOWN,
    getTargets: (state, queen) => getPulls(state, queen).map(p => p.from),
    apply(state, move) {
      const queen = state.pieces.get(move.from)!;
      const pull = getPulls(state, queen).find(p => p.from === move.to)!;
      const victim = state.pieces.get(pull.from)!;
      const next = cloneState(state);
      shiftPiece(next, pull.from, pull.to);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'GET OVER HERE!',
          message: `The ${queen.color} queen pulls the ${victim.color} ${victim.type} from ${pull.from} to ${pull.to}.`,
          squares: [pull.from, pull.to],
        }),
      };
    },
    notation: (_state, move) => `Q${move.from}<${move.to}`,
  },
};
