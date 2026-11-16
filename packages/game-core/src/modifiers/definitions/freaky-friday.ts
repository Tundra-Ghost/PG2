import type { ModifierDefinition } from '../types';
import type { GameState, Piece, PieceType, Square } from '../../engine/types';
import { appendGameEvent, cloneState, getActiveDefinitions } from '../../engine/gameLoop';
import { modifierRegistry } from '../registry';
import { getConfession } from './forgive-me';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.freakyFriday;

/** Own turns both swapped pieces wait. */
export const SWAP_COOLDOWN = 7;

/** Every piece that moves, except the King. Eggs (MOD-E016) never move. */
const SWAPPERS: PieceType[] = [
  'queen', 'rook', 'bishop', 'knight', 'pawn', 'chancellor', 'archbishop',
  'elephant', 'camel', 'nightrider', 'royal_guard', 'pigeon', 'cannon',
];

function neighbours(sq: Square): Square[] {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const result: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const nf = f + df;
      const nr = r + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      result.push(`${String.fromCharCode(97 + nf)}${nr + 1}` as Square);
    }
  }
  return result;
}

/**
 * A pawn may not be swapped onto rank 1 or 8, nor back onto its start rank
 * (it would win its double step again).
 */
function canStand(piece: Piece, sq: Square): boolean {
  if (piece.type !== 'pawn') return true;
  if (sq[1] === '1' || sq[1] === '8') return false;
  const start = piece.color === 'white' ? '2' : '7';
  return sq[1] !== start || piece.square[1] === start;
}

/** Adjacent friendly pieces this piece may trade places with. */
export function getSwapTargets(state: GameState, piece: Piece): Square[] {
  return neighbours(piece.square).filter(sq => {
    const partner = state.pieces.get(sq);
    if (!partner || partner.color !== piece.color) return false;
    if (!SWAPPERS.includes(partner.type)) return false;
    if ((partner.abilityCooldowns?.[ID] ?? 0) > 0) return false;
    return canStand(piece, sq) && canStand(partner, piece.square);
  });
}

/** MOD-C012: two adjacent friendly non-King pieces swap places. */
export const freakyFridayDef: ModifierDefinition = {
  id: ID,
  name: 'Freaky Friday',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Swap',
    hint: 'Pick a neighbouring piece of yours. The two swap places. Not the King.',
    pieceTypes: SWAPPERS,
    cooldown: SWAP_COOLDOWN,
    getTargets: getSwapTargets,
    apply(state, move) {
      const a = state.pieces.get(move.from)!;
      const b = state.pieces.get(move.to)!;
      const next = cloneState(state);
      next.pieces.set(move.to, { ...a, square: move.to });
      // The partner waits as long as the piece that asked. Cooldowns tick
      // once at the end of this turn, so it starts one higher.
      next.pieces.set(move.from, {
        ...b,
        square: move.from,
        abilityCooldowns: { ...b.abilityCooldowns, [ID]: SWAP_COOLDOWN + 1 },
      });
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock++;
      // A rook that leaves its corner has moved: castling on that side ends.
      const homeRank = a.color === 'white' ? '1' : '8';
      for (const [piece, from] of [[a, move.from], [b, move.to]] as const) {
        if (piece.type !== 'rook') continue;
        if (from === `h${homeRank}`) next.flags.castlingRights[a.color].kingSide = false;
        if (from === `a${homeRank}`) next.flags.castlingRights[a.color].queenSide = false;
      }
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'FREAKY FRIDAY',
          // Squares only: naming the types would give away a Sus disguise.
          message: `The ${a.color} pieces on ${move.from} and ${move.to} swap places.`,
          squares: [move.from, move.to],
        }),
      };
    },
    notation(_state, move) {
      return `${move.from}⇄${move.to}`;
    },
  },

  /**
   * The partner moves too, so it must be free to move: a piece held by
   * Gerald, stuck in the Swamp or frozen by Winter cannot be swapped.
   */
  onPreMoveValidate(state, move) {
    if (move.ability !== ID) return { blocked: false };
    const reverse = { ...move, from: move.to, to: move.from };
    const partner = state.pieces.get(reverse.from);
    if (!partner) return { blocked: false };
    // A confessing piece (MOD-C002) must go where it declared.
    const confessing = getConfession(state)?.pieceId;
    if (confessing && (confessing === partner.id || confessing === state.pieces.get(move.from)?.id)) {
      return { blocked: true, reason: 'That piece has confessed. It must make its declared move.' };
    }
    for (const def of getActiveDefinitions(state)) {
      if (def.id === ID || !def.onPreMoveValidate) continue;
      const result = def.onPreMoveValidate(state, reverse);
      if (result.blocked) return result;
    }
    return { blocked: false };
  },

  /**
   * The partner entered move.from. Winter and the Swamp only look at
   * move.to, so run their entry rules for the partner too.
   */
  onPostMove(state, move) {
    if (move.ability !== ID) return state;
    const reverse = { ...move, from: move.to, to: move.from };
    let next = state;
    for (const id of [MODIFIER_IDS.winterIsComing, MODIFIER_IDS.thisIsMySwamp]) {
      if (!state.activeModifiers.some(mod => mod.id === id)) continue;
      const hook = modifierRegistry.get(id)?.onPostMove;
      if (hook) next = hook(next, reverse);
    }
    return next;
  },
};
