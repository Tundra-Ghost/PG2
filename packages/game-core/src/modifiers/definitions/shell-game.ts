import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isSquareAttacked, pieceAttackSquares } from '../../engine/moveGenerator';
import { getHiddenPieceIds, getVisibleSquares, withoutHiddenPieces } from '../../engine/visibility';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.shellGame;

interface Cup {
  pieceId: string;
  square: Square;
}
type ShellState = Partial<Record<Color, Cup[]>>;

function shells(state: GameState): ShellState {
  return (state.modifierState[ID] as ShellState | undefined) ?? {};
}

/** True when `viewer` sees this enemy piece as a cup. */
export function isCup(state: GameState, piece: Piece, viewer: Color): boolean {
  if (piece.color === viewer) return false;
  return (shells(state)[piece.color] ?? []).some(cup => cup.pieceId === piece.id && cup.square === piece.square);
}

/** Squares of `color`'s own pieces still under a cup (what the owner sees). */
export function getOwnCups(state: GameState, color: Color): Square[] {
  return (shells(state)[color] ?? []).map(cup => cup.square);
}

function name(type: Piece['type']): string {
  return type.replace('_', ' ');
}

/** Lifts these cups (by piece id), one event each, naming what was under it. */
function lift(state: GameState, color: Color, ids: string[], why: string): GameState {
  const cups = shells(state)[color] ?? [];
  const lifted = cups.filter(cup => ids.includes(cup.pieceId));
  if (lifted.length === 0) return state;
  let next = cloneState(state);
  next.modifierState = { ...next.modifierState, [ID]: { ...shells(state), [color]: cups.filter(cup => !ids.includes(cup.pieceId)) } };
  for (const cup of lifted) {
    const piece = [...state.pieces.values()].find(p => p.id === cup.pieceId);
    if (!piece) continue;
    next = appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Shell Game',
      squares: [piece.square],
      message: `The cup on ${piece.square} is lifted: a ${color} ${name(piece.type)}. ${why}`,
    });
  }
  return next;
}

/** The board as `color` sees it: enemy pieces hidden from it or in its fog taken off. */
function ownerView(state: GameState, color: Color): GameState {
  const view = withoutHiddenPieces(state, color);
  const visible = getVisibleSquares(state, color);
  if (!visible) return view;
  const pieces = new Map(view.pieces);
  for (const [sq, piece] of pieces) if (piece.color !== color && !visible.has(sq)) pieces.delete(sq);
  return { ...view, pieces };
}

/** Lifts every cup that moved, was moved, or stands attacked. */
function checkCups(state: GameState): GameState {
  let next = state;
  for (const color of ['white', 'black'] as const) {
    const cups = shells(next)[color];
    if (!cups?.length) continue;
    const enemy: Color = color === 'white' ? 'black' : 'white';
    const byId = new Map([...next.pieces.values()].map(p => [p.id, p]));
    const gone = cups.filter(cup => !byId.has(cup.pieceId)).map(cup => cup.pieceId);
    if (gone.length) {
      next = cloneState(next);
      next.modifierState = { ...next.modifierState, [ID]: { ...shells(next), [color]: cups.filter(cup => !gone.includes(cup.pieceId)) } };
    }
    const moved = cups.filter(cup => byId.get(cup.pieceId) && byId.get(cup.pieceId)!.square !== cup.square).map(cup => cup.pieceId);
    next = lift(next, color, moved, 'It moved.');
    // Only attackers the owner can see count, so a lift never gives away a hidden or fogged enemy.
    const seen = ownerView(next, color);
    const attacked = (shells(next)[color] ?? []).filter(cup => isSquareAttacked(seen, cup.square, enemy)).map(cup => cup.pieceId);
    next = lift(next, color, attacked, 'It is under attack.');
    // A cup that gives check is lifted: the check comes from the real piece.
    const kings = [...next.pieces.values()].filter(p => p.color === enemy && p.type === 'king').map(p => p.square);
    const checking = (shells(next)[color] ?? []).filter(cup => {
      const piece = next.pieces.get(cup.square);
      return piece && pieceAttackSquares(next, piece).some(sq => kings.includes(sq));
    }).map(cup => cup.pieceId);
    next = lift(next, color, checking, 'It gives check.');
  }
  return next;
}

/**
 * MOD-D014: the owner's Queen and two pieces from her rank look like cups to
 * the opponent. Each cup is lifted the first time its piece moves, is
 * attacked or gives check. The
 * King is never a cup (Core rule 1).
 */
export const shellGameDef: ModifierDefinition = {
  id: ID,
  name: 'Shell Game',
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
      // Squares, not ids: ids differ each time the start position is built.
      const own = [...next.pieces.values()].filter(p => p.color === color && !p.isGhost).sort((a, b) => a.square.localeCompare(b.square));
      const queen = own.find(p => p.type === 'queen');
      // Decoys stand on the Queen's rank, so her square never gives her away.
      // Without enough of those, pawns make up the rest.
      const rank = queen?.square[1];
      const sameRank = own.filter(p => p !== queen && p.type !== 'king' && !p.isRealKing && p.square[1] === rank);
      const pawns = own.filter(p => p.type === 'pawn' && p.square[1] !== rank);
      const picked: Piece[] = queen ? [queen] : [];
      for (const pool of [sameRank, pawns]) {
        while (picked.length < 3 && pool.length > 0) {
          const [idx, prng] = prngPickIndex(next.prngState, pool.length);
          next.prngState = prng;
          picked.push(pool.splice(idx, 1)[0]);
        }
      }
      next.modifierState = { ...next.modifierState, [ID]: { ...shells(next), [color]: picked.map(p => ({ pieceId: p.id, square: p.square })) } };
    }
    return next;
  },

  // Online: enemy cups are sent only where the viewer can see them.
  redactState(state, viewer) {
    const all = shells(state);
    const enemy: Color = viewer === 'white' ? 'black' : 'white';
    const visible = getVisibleSquares(state, viewer);
    const hidden = getHiddenPieceIds(state, viewer);
    const seen = (all[enemy] ?? []).filter(cup => !hidden.has(cup.pieceId) && (!visible || visible.has(cup.square)));
    return { ...(all[viewer] ? { [viewer]: all[viewer] } : {}), ...(seen.length ? { [enemy]: seen } : {}) };
  },

  onPostMove(state) {
    return checkCups(state);
  },

  onTurnStart(state) {
    return checkCups(state);
  },
};
