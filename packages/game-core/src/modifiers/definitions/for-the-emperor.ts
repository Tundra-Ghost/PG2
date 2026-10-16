import type { ModifierDefinition } from '../types';
import type { GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.forTheEmperor;
const FILES = 'abcdefgh';
const DIRECTIONS: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];

/**
 * The first piece the cannonball meets in each direction, any colour.
 * Kings stop the ball harmlessly, so they are never targets. Void shafts
 * are flown over.
 */
export function cannonTargets(state: GameState, rook: Piece): Square[] {
  const targets: Square[] = [];
  const f0 = FILES.indexOf(rook.square[0]);
  const r0 = Number(rook.square[1]);
  for (const [df, dr] of DIRECTIONS) {
    for (let n = 1; n < 8; n++) {
      const f = f0 + df * n;
      const r = r0 + dr * n;
      if (f < 0 || f > 7 || r < 1 || r > 8) break;
      const sq = `${FILES[f]}${r}` as Square;
      const hit = state.pieces.get(sq);
      if (!hit) continue;
      if (hit.type !== 'king') targets.push(sq);
      break;
    }
  }
  return targets;
}

/** MOD-C006: once every 7 turns, a rook fires along its rank or file. */
export const forTheEmperorDef: ModifierDefinition = {
  id: ID,
  name: 'FOR THE EMPEROR',
  category: 'C',
  pointCost: 4,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Fire cannon',
    hint: 'The rook stays put and destroys the first piece in a line. Either colour. Never a king.',
    pieceTypes: ['rook'],
    cooldown: 7,
    getTargets: cannonTargets,
    apply(state, move) {
      const rook = state.pieces.get(move.from)!;
      const captured = state.pieces.get(move.to);
      const next = cloneState(state);
      next.pieces.delete(move.to);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock = 0;
      const homeRank = captured?.color === 'white' ? '1' : '8';
      if (captured?.type === 'rook' && move.to === `h${homeRank}`) next.flags.castlingRights[captured.color].kingSide = false;
      if (captured?.type === 'rook' && move.to === `a${homeRank}`) next.flags.castlingRights[captured.color].queenSide = false;
      const fired = appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'FOR THE EMPEROR',
        message: captured
          ? `The ${rook.color} rook on ${move.from} fires and destroys the ${captured.color} ${captured.type} on ${move.to}.`
          : `The ${rook.color} rook on ${move.from} fires.`,
      });
      return { state: fired, captured };
    },
    notation: (_state, move) => `R${move.from}*${move.to}`,
  },
};
