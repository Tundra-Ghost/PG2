import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, PieceType, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.ghosts;
export const GHOSTS_PER_SIDE = 2;
const GHOST_TYPES: PieceType[] = ['knight', 'bishop'];
const FILES = 'abcdefgh';

/** Empty squares on the owner's third rank, where a developed piece could sit. */
function ghostSquares(state: GameState, color: Color): Square[] {
  const rank = color === 'white' ? 3 : 6;
  return [...FILES].map(f => `${f}${rank}` as Square).filter(sq => !state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid);
}

/**
 * MOD-D002: the owner gets 2 Ghost Pieces. They look real to the opponent
 * and move like their type, but they never capture and never give check.
 * An enemy that captures a Ghost finds nothing there.
 */
export const ghostsDef: ModifierDefinition = {
  id: ID,
  name: 'I\'m Literally Right Here',
  category: 'D',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const owners: Color[] = owner ? [owner] : ['white', 'black'];
    const next = cloneState(state);
    for (const color of owners) {
      const already = [...next.pieces.values()].filter(p => p.isGhost && p.color === color).length;
      for (let i = already; i < already + GHOSTS_PER_SIDE; i++) {
        const free = ghostSquares(next, color);
        if (free.length === 0) break;
        const [sqIdx, prngA] = prngPickIndex(next.prngState, free.length);
        const [typeIdx, prngB] = prngPickIndex(prngA, GHOST_TYPES.length);
        next.prngState = prngB;
        const square = free[sqIdx];
        const ghost: Piece = { id: `ghost-${color}-${i + 1}`, type: GHOST_TYPES[typeIdx], color, square, isGhost: true, cooldowns: {} };
        next.pieces.set(square, ghost);
      }
    }
    return next;
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (!piece?.isGhost) return { blocked: false };
    if (move.ability) return { blocked: true, reason: 'A Ghost has no abilities.' };
    const target = state.pieces.get(move.to);
    if (target && target.color !== piece.color) return { blocked: true, reason: 'A Ghost cannot capture.' };
    return { blocked: false };
  },

  onCapture(state, move, captured) {
    if (!captured.isGhost) return state;
    return appendGameEvent(state, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'I\'m Literally Right Here',
      squares: [move.to],
      message: `The ${captured.color} ${captured.type} on ${move.to} was a Ghost. It vanishes.`,
    });
  },
};
