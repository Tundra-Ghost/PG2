import type { ModifierDefinition } from '../types';
import type { Color } from '../../engine/types';
import { appendGameEvent, applyMoveInternal, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.theSnap;
export const MAX_TEMPO_TOKENS = 2;

/** MOD-C007: sacrifice a piece for a tempo token, spend a token to move twice in a row. */
export const theSnapDef: ModifierDefinition = {
  id: ID,
  name: 'This Is Necessary (The Snap)',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Sacrifice',
    hint: 'Remove this piece for a tempo token. Spend a token to move twice in a row. Max 2.',
    pieceTypes: ['queen', 'rook', 'bishop', 'knight', 'pawn', 'chancellor', 'royal_guard', 'pigeon'],
    cooldown: 1,
    getTargets: (state, piece) =>
      (state.tempoTokens[piece.color] ?? 0) < MAX_TEMPO_TOKENS ? [piece.square] : [],
    apply(state, move) {
      const piece = state.pieces.get(move.from)!;
      const color: Color = piece.color;
      const next = cloneState(state);
      next.pieces.delete(move.from);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock = 0;
      next.tempoTokens = { ...next.tempoTokens, [color]: (next.tempoTokens[color] ?? 0) + 1 };
      const homeRank = color === 'white' ? '1' : '8';
      if (piece.type === 'rook' && move.from === `h${homeRank}`) next.flags.castlingRights[color].kingSide = false;
      if (piece.type === 'rook' && move.from === `a${homeRank}`) next.flags.castlingRights[color].queenSide = false;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'THIS IS NECESSARY',
          message: `The ${color} ${piece.type} on ${move.from} volunteers. A tempo token goes to ${color}.`,
        }),
      };
    },
    notation: (_state, move) => `${move.from}†`,
  },

  onPreMoveValidate(state, move) {
    if (!move.extraTurn) return { blocked: false };
    // The extra move cannot give check: the same side would move again and take the king.
    const after = applyMoveInternal(cloneState(state), move);
    const opponent: Color = move.playerColor === 'white' ? 'black' : 'white';
    if (isInCheck(after, opponent)) {
      return { blocked: true, reason: 'The Snap: a move that gives check cannot use a tempo token.' };
    }
    return { blocked: false };
  },

  onPostMove(state, move) {
    if (!move.extraTurn) return state;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'THE SNAP',
      message: `A tempo token is spent. Another move for ${move.playerColor}.`,
    });
  },
};
