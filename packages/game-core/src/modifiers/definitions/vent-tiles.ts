import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { teleport } from '../../engine/teleport';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.ventTiles;
const FILES = 'abcdefgh';
export const VENT_COUNT = 3;

/** The square diametrically opposite through the board centre. */
export function oppositeSquare(square: Square): Square {
  const f = 7 - FILES.indexOf(square[0]);
  const r = 9 - Number(square[1]);
  return `${FILES[f]}${r}` as Square;
}

/** Vents spawn on empty ranks 3 to 6, never opposite each other. */
function ventCandidates(state: GameState): Square[] {
  const squares: Square[] = [];
  for (const file of FILES) {
    for (const rank of [3, 4, 5, 6]) {
      const sq = `${file}${rank}` as Square;
      const tile = state.tiles.get(sq);
      if (state.pieces.has(sq) || tile?.isVent || tile?.isVoid || tile?.isSwamp) continue;
      if (state.tiles.get(oppositeSquare(sq))?.isVent) continue;
      squares.push(sq);
    }
  }
  return squares;
}

/** Sus: a piece is named as the other side sees it, so the log never gives a disguise away. */
function shown(state: GameState, piece: Piece): string {
  return getShownType(state, piece, piece.color === 'white' ? 'black' : 'white');
}

function label(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

export const ventTilesDef: ModifierDefinition = {
  id: ID,
  name: 'Vent Tiles',
  category: 'A',
  pointCost: 2,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const next = cloneState(state);
    for (let i = 0; i < VENT_COUNT; i++) {
      const candidates = ventCandidates(next);
      if (candidates.length === 0) break;
      const [idx, prng] = prngPickIndex(next.prngState, candidates.length);
      next.prngState = prng;
      const sq = candidates[idx];
      const tile = next.tiles.get(sq) ?? { square: sq, effects: [] };
      next.tiles.set(sq, { ...tile, isVent: true });
    }
    return next;
  },

  onPostMove(state, move) {
    const vent = move.to;
    if (!state.tiles.get(vent)?.isVent) return state;
    const piece = state.pieces.get(vent);
    if (!piece) return state;

    // Kings are too heavy for the vent. It stays hidden.
    if (piece.type === 'king') return state;

    const exit = oppositeSquare(vent);
    // A void exit (a Dirt Hut wall, a flock, the statue), a King on the exit,
    // or a jump that exposes the mover's own King jams the vent: nothing
    // happens and it stays hidden for the next piece.
    const jump = teleport(state, vent, exit, { capture: true });
    if (!jump) return state;
    const ejected = jump.state;
    const occupant = jump.taken;

    ejected.tiles.set(vent, { ...ejected.tiles.get(vent)!, isVent: false, isVoid: true });
    return appendGameEvent(ejected, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Vent',
      message: occupant
        ? `${label(piece.color)}'s ${shown(state, piece)} vents from ${vent} to ${exit}, taking the ${occupant.color} ${shown(state, occupant)}.`
        : `${label(piece.color)}'s ${shown(state, piece)} vents from ${vent} to ${exit}.`,
    });
  },
};
