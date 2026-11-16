import type { ModifierDefinition } from '../types';
import type { Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { getStatueSquare } from '../../engine/statue';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.monumentToGerald;

/** Where the statue is unveiled, with fallbacks if e4 is taken at the start. */
const PLINTHS: Square[] = ['e4', 'd4', 'e5', 'd5'];

/**
 * MOD-A016: a statue of Gerald stands on e4. Nothing can land on it or pass
 * through it, and it blocks lines of check. A piece that could step into it
 * from a neighbouring square pushes it one square the same way instead, if
 * that square is empty. The push is the whole move. The engine does the
 * pushing (engine/statue.ts); this card puts the statue on the board and
 * tells the feed about each push.
 */
export const monumentToGeraldDef: ModifierDefinition = {
  id: ID,
  name: 'Monument To Gerald',
  category: 'A',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const spot = PLINTHS.find(sq => !state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid);
    if (!spot) return state;
    const next = cloneState(state);
    const tile = next.tiles.get(spot) ?? { square: spot, effects: [] };
    next.tiles.set(spot, { ...tile, statue: true, isVoid: true });
    return next;
  },

  /**
   * Tell the feed about a push once it has happened. Another card (Forgive
   * Me) can turn the move into something else first, so check the board.
   */
  onPostMove(state, move) {
    if (move.ability) return state;
    const df = move.to.charCodeAt(0) - move.from.charCodeAt(0);
    const dr = Number(move.to[1]) - Number(move.from[1]);
    const beyond = `${String.fromCharCode(move.to.charCodeAt(0) + df)}${Number(move.to[1]) + dr}`;
    const pushed = Math.max(Math.abs(df), Math.abs(dr)) === 1
      && getStatueSquare(state) === beyond
      && state.pieces.get(move.from) !== undefined
      && !state.pieces.has(move.to);
    if (!pushed) return state;
    return appendGameEvent(cloneState(state), {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Monument To Gerald',
      message: `Gerald's statue is pushed from ${move.to} to ${beyond}.`,
      squares: [move.to, beyond as Square],
    });
  },
};
