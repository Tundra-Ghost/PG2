import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.hatchery;
/** The Egg hatches after this many of its owner's moves (10 rounds). */
export const EGG_ROUNDS = 10;
/** Where to lay the Egg: d3 first, then the nearest file on the same rank. */
const FILE_ORDER = 'decfbgah';

function nestSquare(state: GameState, color: Color): Square | null {
  const rank = color === 'white' ? '3' : '6';
  for (const file of FILE_ORDER) {
    const sq = `${file}${rank}` as Square;
    const tile = state.tiles.get(sq);
    // Never nest on lava or any other tile effect: the Egg cannot step off.
    if (!state.pieces.has(sq) && !tile?.isVoid && !(tile?.effects.length)) return sq;
  }
  return null;
}

/** Owner moves left before the Egg on `piece` hatches, or null if it is not a counting Egg. */
export function getEggRoundsLeft(piece: Piece): number | null {
  if (piece.type !== 'egg') return null;
  return piece.cooldowns[ID] ?? null;
}

/**
 * MOD-E016 Hatchery: an Egg on the owner's d3 that cannot move. After 10 of
 * the owner's moves it hatches into a Pigeon (moves like a knight). The
 * count lives on the Egg's cooldowns, so the board can show it.
 */
export const hatcheryDef: ModifierDefinition = {
  id: ID,
  name: 'Hatchery',
  category: 'E',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owner = getModifierOwner(state, ID);
    const colors: Color[] = owner ? [owner] : ['white', 'black'];
    let next = cloneState(state);
    for (const color of colors) {
      const square = nestSquare(next, color);
      if (!square) {
        next = appendGameEvent(next, {
          ply: next.moveHistory.length,
          type: 'modifier',
          modifierId: ID,
          title: 'Hatchery',
          message: `There is no room for the ${color} Egg.`,
        });
        continue;
      }
      next.pieces.set(square, {
        id: `egg-${color}`,
        type: 'egg',
        color,
        square,
        cooldowns: { [ID]: EGG_ROUNDS },
      });
    }
    return next;
  },

  onPostMove(state, move) {
    // Every Egg of the mover counts down, even one that changed sides.
    const mover = state.turn;
    const eggs = [...state.pieces.values()].filter(p => p.type === 'egg' && p.color === mover);
    if (eggs.length === 0) return state;

    let next = cloneState(state);
    const hatched: Square[] = [];
    for (const egg of eggs) {
      // An Egg bought back with Moneyball starts a fresh count.
      let left = (egg.cooldowns[ID] ?? EGG_ROUNDS + 1) - 1;
      // Never hatch on a This Is Necessary extra move: the same side would move
      // again with the new Pigeon giving check.
      if (left <= 0 && move.extraTurn) left = 1;
      const cooldowns = { ...egg.cooldowns };
      if (left > 0) {
        cooldowns[ID] = left;
        next.pieces.set(egg.square, { ...egg, cooldowns });
        continue;
      }
      delete cooldowns[ID];
      next.pieces.set(egg.square, { ...egg, type: 'pigeon', cooldowns });
      hatched.push(egg.square);
    }
    if (hatched.length === 0) return next;
    next = appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Hatchery',
      squares: hatched,
      message: `The ${mover} Egg on ${hatched.join(', ')} hatches. A Pigeon is born.`,
    });
    return next;
  },
};
