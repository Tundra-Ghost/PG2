import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, PieceType, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck, slidingMoves } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.forgiveMe;
/** Plies after the Confession it lasts: the target side's next 2 turns. */
export const CONFESSION_PLIES = 3;
const DIAGONALS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const LETTER: Partial<Record<PieceType, string>> = {
  queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', chancellor: 'C', archbishop: 'A', royal_guard: 'G', pigeon: 'H',
};

interface Confession {
  pieceId: string;
  color: Color;
  /** Last ply number the confession covers. */
  until: number;
  /** The square the piece has declared, once it has. */
  declared?: Square;
}

function nextPly(state: GameState): number {
  return state.moveHistory.length + 1;
}

/** The live confession, or null. */
export function getConfession(state: GameState): (Confession & { square: Square }) | null {
  if (!state.activeModifiers.some(mod => mod.id === ID)) return null;
  const c = state.modifierState[ID] as Confession | undefined;
  if (!c || nextPly(state) > c.until) return null;
  const piece = [...state.pieces.values()].find(p => p.id === c.pieceId);
  return piece ? { ...c, square: piece.square } : null;
}

function setConfession(state: GameState, c: Confession | null): GameState {
  const next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: c ?? undefined };
  return next;
}

function name(piece: Piece): string {
  return `${piece.color} ${piece.type.replace('_', ' ')}`;
}

/**
 * MOD-C002: the bishop makes an enemy piece on its diagonal confess. For
 * that side's next 2 turns, moving the piece takes two steps: first it
 * declares its square (the turn is spent and a ghost outline appears),
 * then it may move only there. In check, it moves freely.
 */
export const forgiveMeDef: ModifierDefinition = {
  id: ID,
  name: 'Forgive Me, For I Have Moved',
  category: 'C',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Confession',
    hint: 'Pick an enemy piece on this bishop\'s diagonal. For 2 turns it must declare each move a turn early.',
    pieceTypes: ['bishop'],
    cooldown: 5,
    getTargets(state, bishop) {
      return slidingMoves(state, bishop, DIAGONALS).filter(sq => {
        const target = state.pieces.get(sq);
        return target && target.color !== bishop.color && target.type !== 'king';
      });
    },
    apply(state, move) {
      const piece = state.pieces.get(move.from)!;
      const ply = nextPly(state);
      const current = getConfession(state);
      // A confessing piece's first move is turned into this declaration.
      if (current && current.pieceId === piece.id) {
        const next = setConfession(state, { ...current, declared: move.to });
        return {
          state: appendGameEvent(next, {
            ply,
            type: 'modifier',
            modifierId: ID,
            title: 'Forgive Me, For I Have Moved',
            squares: [move.to],
            message: `The ${name(piece)} confesses. It will move to ${move.to}.`,
          }),
        };
      }
      const target = state.pieces.get(move.to)!;
      const next = setConfession(state, { pieceId: target.id, color: target.color, until: ply + CONFESSION_PLIES });
      return {
        state: appendGameEvent(next, {
          ply,
          type: 'modifier',
          modifierId: ID,
          title: 'Forgive Me, For I Have Moved',
          squares: [move.to],
          message: `The ${name(target)} on ${move.to} must confess its moves for 2 turns.`,
        }),
      };
    },
    notation(state, move) {
      const piece = state.pieces.get(move.from);
      const current = getConfession(state);
      if (piece && current?.pieceId === piece.id) return `${LETTER[piece.type] ?? ''}…${move.to}`;
      return `B${move.from}✝${move.to}`;
    },
  },

  onPreMoveValidate(state, move) {
    if (move.ability) return { blocked: false };
    const c = getConfession(state);
    if (!c?.declared || c.square !== move.from) return { blocked: false };
    if (isInCheck(state, c.color) || move.to === c.declared) return { blocked: false };
    return { blocked: true, reason: `Forgive Me: this piece confessed. It can only move to ${c.declared}.` };
  },

  onPreMoveApply(state, move) {
    const c = getConfession(state);
    if (!c || c.declared || c.square !== move.from || isInCheck(state, c.color)) return { state, move };
    // First move of a confessing piece: declare it instead (see ability.apply).
    return { state, move: { from: move.from, to: move.to, playerColor: move.playerColor, ability: ID } };
  },

  onPostMove(state, move) {
    if (move.ability) return state;
    const c = getConfession(state);
    const piece = state.pieces.get(move.to);
    if (!c || !piece || piece.id !== c.pieceId) return state;
    return setConfession(state, null);
  },

  getRevealedSquares(state) {
    const c = getConfession(state);
    return c ? [c.square, ...(c.declared ? [c.declared] : [])] : [];
  },
};
