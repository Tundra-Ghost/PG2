import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { prngPickIndex } from '../../engine/prng';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { getHiddenPieceIds, getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.minesweeper;
const FILES = 'abcdefgh';

/** A number shown on a square: how many live mines touch it. */
export interface MineClue {
  square: Square;
  count: number;
  /** The piece that stopped here, so the clue is not shown while that piece is hidden. */
  pieceId: string;
}

interface MineState {
  /** Secret: never sent to online clients (redactState). */
  mines?: Square[];
  clues?: MineClue[];
  /** The piece making this move, and whether its opponent could not see it, set before the move. */
  mover?: string;
  moverHidden?: boolean;
}

function mineState(state: GameState): MineState {
  return (state.modifierState[ID] as MineState | undefined) ?? {};
}

function touching(square: Square, mines: readonly Square[]): number {
  return ALL_DIRECTIONS.filter(([df, dr]) => {
    const sq = offset(square, df, dr);
    return sq !== null && mines.includes(sq);
  }).length;
}

/** Picks `count` mines from `squares`, seeded. */
function pick(prng: number, squares: Square[], count: number): [Square[], number] {
  const pool = [...squares];
  const out: Square[] = [];
  while (out.length < count && pool.length > 0) {
    const [idx, next] = prngPickIndex(prng, pool.length);
    prng = next;
    out.push(pool.splice(idx, 1)[0]);
  }
  return [out, prng];
}

/**
 * MOD-A014: the clue on each square that `viewer` may see: the newest one
 * not left by a piece hidden from `viewer`, and none on a square in fog.
 * Older clues are kept, so a hidden piece stopping on a clue square never
 * makes its number vanish. Null viewer sees the newest on each square.
 */
export function getMineClues(state: GameState, viewer: Color | null): MineClue[] {
  const clues = mineState(state).clues ?? [];
  const hidden = viewer ? getHiddenPieceIds(state, viewer) : new Set<string>();
  const visible = viewer ? getVisibleSquares(state, viewer) : null;
  const newest = new Map<Square, MineClue>();
  for (const clue of clues) {
    if (hidden.has(clue.pieceId) || (visible && !visible.has(clue.square))) continue;
    newest.set(clue.square, clue);
  }
  return [...newest.values()];
}

function side(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * MOD-A014: four hidden mines, two on ranks 3-4 and two on ranks 5-6,
 * picked with the game seed, never next to a King and never under a piece.
 * The piece that makes a move and stops on a mine is lost (Kings never set
 * one off) and the mine is used up. A piece that stops elsewhere leaves a
 * number on its square: how many live mines touch it. Numbers update when a
 * mine is used. Online, the mines are never sent (redactState).
 */
export const minesweeperDef: ModifierDefinition = {
  id: ID,
  name: 'Minesweeper',
  category: 'A',
  pointCost: 3,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onActivate(state) {
    const kings = [...state.pieces.values()].filter(p => p.type === 'king').map(p => p.square);
    const open = (ranks: string[]) =>
      [...FILES].flatMap(f => ranks.map(r => `${f}${r}` as Square)).filter(sq =>
        !state.pieces.has(sq) && !state.tiles.get(sq)?.isVoid && !kings.some(k => k === sq || touching(k, [sq]) > 0));
    const [low, prng1] = pick(state.prngState, open(['3', '4']), 2);
    const [high, prng2] = pick(prng1, open(['5', '6']), 2);
    return { ...state, prngState: prng2, modifierState: { ...state.modifierState, [ID]: { mines: [...low, ...high], clues: [] } satisfies MineState } };
  },

  onPreMoveApply(state, move) {
    const mover = state.pieces.get(move.from);
    if (!mover) return { state, move };
    const moverHidden = getHiddenPieceIds(state, mover.color === 'white' ? 'black' : 'white').has(mover.id);
    return { state: { ...state, modifierState: { ...state.modifierState, [ID]: { ...mineState(state), mover: mover.id, moverHidden } } }, move };
  },

  onPostMove(state, move) {
    const { mover, moverHidden, ...memo } = mineState(state);
    state = { ...state, modifierState: { ...state.modifierState, [ID]: memo } };
    // Only the moving piece, on the square its move ended on. Abilities never set
    // mover. A piece another card has already moved on (whatever the draft order) does nothing.
    const at = move.to;
    const piece = state.pieces.get(at);
    if (!piece || piece.id !== mover) return state;
    const mines = memo.mines ?? [];
    // Older clues on this square stay (see getMineClues); only this piece's own old one goes.
    let clues = (memo.clues ?? []).filter(c => !(c.square === at && c.pieceId === piece.id));

    if (piece.type !== 'king' && mines.includes(at)) {
      const next = cloneState(state);
      next.pieces.delete(at);
      // A mine never leaves its own side's King in check: then it stays hidden.
      if (!isInCheck(next, piece.color)) {
        const left = mines.filter(sq => sq !== at);
        clues = clues.map(c => ({ ...c, count: touching(c.square, left) }));
        next.modifierState = { ...next.modifierState, [ID]: { mines: left, clues } satisfies MineState };
        return appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Mine!',
          // A piece its opponent could not see is not named (Sus: the type they see).
          message: moverHidden
            ? `${side(piece.color)}'s hidden piece steps on a mine on ${at} and is lost.`
            : `${side(piece.color)}'s ${getShownType(state, piece, piece.color === 'white' ? 'black' : 'white')} steps on a mine on ${at} and is lost.`,
          squares: [at],
        });
      }
    }
    clues = [...clues, { square: at, count: touching(at, mines), pieceId: piece.id }];
    return { ...state, modifierState: { ...state.modifierState, [ID]: { mines, clues } satisfies MineState } };
  },

  /** Online: never the mines, and no clue the viewer could not see. */
  redactState(state, viewer) {
    return { clues: getMineClues(state, viewer) } satisfies MineState;
  },
};
