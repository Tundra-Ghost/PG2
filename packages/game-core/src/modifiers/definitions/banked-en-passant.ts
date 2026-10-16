import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { affectsColor } from '../owner';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.bankedEnPassant;
const FILES = 'abcdefgh';
/** Own turns a banked en passant stays usable. */
export const BANK_TURNS = 3;

interface Bank {
  victimId: string;
  color: Color;
  turnsLeft: number;
}

function banks(state: GameState): Record<string, Bank> {
  return (state.modifierState[ID] as Record<string, Bank> | undefined) ?? {};
}

function findById(state: GameState, id: string): Piece | undefined {
  for (const piece of state.pieces.values()) if (piece.id === id) return piece;
  return undefined;
}

/**
 * The square a pawn can take its banked en passant on, and the pawn it takes.
 * Null when there is no bank, or either pawn has moved since.
 */
export function getBankedEnPassant(state: GameState, pawn: Piece): { to: Square; victim: Piece } | null {
  const bank = banks(state)[pawn.id];
  if (!bank) return null;
  const victim = findById(state, bank.victimId);
  if (!victim || victim.type !== 'pawn' || victim.color === pawn.color) return null;
  if (victim.square[1] !== pawn.square[1]) return null;
  if (Math.abs(FILES.indexOf(victim.square[0]) - FILES.indexOf(pawn.square[0])) !== 1) return null;
  const to = `${victim.square[0]}${Number(pawn.square[1]) + (pawn.color === 'white' ? 1 : -1)}` as Square;
  if (state.pieces.has(to) || state.tiles.get(to)?.isVoid) return null;
  return { to, victim };
}

/** MOD-C008: en passant can be banked and taken up to 3 turns later. */
export const bankedEnPassantDef: ModifierDefinition = {
  id: ID,
  name: 'I\'ve Been Waiting For This',
  category: 'C',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Banked en passant',
    hint: 'Take the pawn that double-stepped past this one, en passant style.',
    pieceTypes: ['pawn'],
    cooldown: 3,
    getTargets(state, piece) {
      const banked = getBankedEnPassant(state, piece);
      return banked ? [banked.to] : [];
    },
    apply(state, move) {
      const pawn = state.pieces.get(move.from)!;
      const banked = getBankedEnPassant(state, pawn)!;
      const next = cloneState(state);
      next.pieces.delete(move.from);
      next.pieces.delete(banked.victim.square);
      next.pieces.set(move.to, { ...pawn, square: move.to });
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock = 0;
      const rest = { ...banks(state) };
      delete rest[pawn.id];
      next.modifierState[ID] = rest;
      const struck = appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'I\'VE BEEN WAITING FOR THIS',
        message: `The ${pawn.color} pawn on ${move.from} remembered. It takes on ${move.to}.`,
      });
      return { state: struck, captured: banked.victim };
    },
    notation: (_state, move) => `${move.from[0]}x${move.to} e.p.`,
  },

  onPostMove(state, move) {
    if (move.ability) return state;
    const moved = state.pieces.get(move.to);
    if (moved?.type !== 'pawn' || Math.abs(Number(move.to[1]) - Number(move.from[1])) !== 2) return state;
    const f = FILES.indexOf(move.to[0]);
    const added: Record<string, Bank> = {};
    for (const df of [-1, 1]) {
      if (f + df < 0 || f + df > 7) continue;
      const neighbour = state.pieces.get(`${FILES[f + df]}${move.to[1]}` as Square);
      if (neighbour?.type !== 'pawn' || neighbour.color === moved.color) continue;
      if (!affectsColor(state, ID, neighbour.color)) continue;
      added[neighbour.id] = { victimId: moved.id, color: neighbour.color, turnsLeft: BANK_TURNS };
    }
    if (Object.keys(added).length === 0) return state;
    const next = cloneState(state);
    next.modifierState[ID] = { ...banks(state), ...added };
    return next;
  },

  onTurnEnd(state) {
    const current = banks(state);
    if (Object.keys(current).length === 0) return state;
    // state.turn is the side about to move, so the other side just used a turn.
    const kept: Record<string, Bank> = {};
    for (const [pawnId, bank] of Object.entries(current)) {
      const left = bank.color === state.turn ? bank.turnsLeft : bank.turnsLeft - 1;
      if (left > 0 && findById(state, pawnId) && findById(state, bank.victimId)) {
        kept[pawnId] = { ...bank, turnsLeft: left };
      }
    }
    const next = cloneState(state);
    next.modifierState[ID] = kept;
    return next;
  },
};
