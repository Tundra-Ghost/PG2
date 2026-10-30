import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.gravitationalAnomaly;
const FILES = 'abcdefgh';

/** Plies between gravity shifts: 12 full turns. */
export const GRAVITY_SHIFT_PLIES = 24;
/** Plies of warning before a shift. */
export const GRAVITY_WARNING_PLIES = 2;

export type GravityDirection = 'north' | 'east' | 'south' | 'west';
/**
 * Shifts alternate sideways. A north or south shift would push one side's
 * whole back rank off the board, so the prototype keeps gravity fair.
 */
export const GRAVITY_ORDER: GravityDirection[] = ['east', 'west'];

const STEP: Record<GravityDirection, [number, number]> = {
  north: [0, 1],
  east: [1, 0],
  south: [0, -1],
  west: [-1, 0],
};

export interface GravityState {
  /** Shifts already applied. */
  shifts: number;
}

function readState(state: GameState): GravityState {
  const raw = state.modifierState[ID] as Partial<GravityState> | undefined;
  return { shifts: typeof raw?.shifts === 'number' ? raw.shifts : 0 };
}

export function gravityDirection(shiftIndex: number): GravityDirection {
  return GRAVITY_ORDER[shiftIndex % GRAVITY_ORDER.length];
}

function square(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${FILES[f]}${r + 1}` as Square;
}

/**
 * Every piece slides one square toward the edge. Pieces are moved edge-first
 * so a column moves together. A piece pushed off the board (or into a void
 * square) is lost, except kings, which brace against the edge.
 */
export function slideAll(
  state: GameState,
  direction: GravityDirection,
): { next: GameState; moved: Square[]; lost: Piece[] } {
  const [df, dr] = STEP[direction];
  const next = cloneState(state);
  const moved: Square[] = [];
  const lost: Piece[] = [];

  const order = Array.from(state.pieces.values()).sort((a, b) => {
    const lead = (p: Piece) => (FILES.indexOf(p.square[0]) * df) + ((Number(p.square[1]) - 1) * dr);
    return lead(b) - lead(a);
  });

  for (const piece of order) {
    const f = FILES.indexOf(piece.square[0]);
    const r = Number(piece.square[1]) - 1;
    const to = square(f + df, r + dr);
    const off = to === null || next.tiles.get(to)?.isVoid === true;
    if (off) {
      if (piece.type === 'king') continue;
      next.pieces.delete(piece.square);
      lost.push(piece);
      continue;
    }
    if (next.pieces.has(to)) continue; // blocked by a piece that could not move
    next.pieces.delete(piece.square);
    let slid: Piece = { ...piece, square: to };
    // A pawn pushed onto its last rank is crowned on the spot.
    const lastRank = piece.color === 'white' ? '8' : '1';
    if (piece.type === 'pawn' && to[1] === lastRank) slid = { ...slid, type: 'queen' };
    next.pieces.set(to, slid);
    moved.push(to);
  }

  if (moved.length > 0 || lost.length > 0) {
    next.flags.enPassantSquare = null;
    for (const color of ['white', 'black'] as Color[]) {
      next.flags.castlingRights[color] = { kingSide: false, queenSide: false };
    }
  }
  return { next, moved, lost };
}

export const gravitationalAnomalyDef: ModifierDefinition = {
  id: ID,
  name: 'Gravitational Anomaly',
  category: 'A',
  pointCost: 5,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'shared',

  onPostMove(state) {
    const plies = state.moveHistory.length + 1;
    const { shifts } = readState(state);
    const due = Math.floor(plies / GRAVITY_SHIFT_PLIES);
    const direction = gravityDirection(shifts);

    if (due <= shifts) {
      const warnAt = (shifts + 1) * GRAVITY_SHIFT_PLIES - GRAVITY_WARNING_PLIES;
      if (plies !== warnAt) return state;
      return appendGameEvent(cloneState(state), {
        ply: plies,
        type: 'modifier',
        modifierId: ID,
        title: 'Gravity',
        message: `Gravity is about to shift ${direction}. Everything will slide one square.`,
      });
    }

    const { next, moved, lost } = slideAll(state, direction);
    // Never leave the side that just moved in check; try again next ply.
    if (isInCheck(next, state.turn)) return state;
    next.modifierState[ID] = { shifts: shifts + 1 } satisfies GravityState;
    const lostText = lost.length
      ? ` Lost off the edge: ${lost.map(p => `${p.color} ${p.type}`).join(', ')}.`
      : '';
    return appendGameEvent(next, {
      ply: plies,
      type: 'modifier',
      modifierId: ID,
      title: 'Gravity',
      squares: moved,
      message: `Gravity shifts ${direction}. Everything slides one square.${lostText}`,
    });
  },
};
