import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.noFlyZone;
const FILES = 'abcdefgh';
/** Enemy turns a declared line stays closed. */
export const NO_FLY_TURNS = 3;

interface NoFlyLine {
  color: Color;
  /** 'file' closes a column (index 0-7 = a-h); 'rank' closes a row (index 0-7 = 1-8). */
  axis: 'file' | 'rank';
  index: number;
  turnsLeft: number;
}

function lines(state: GameState): NoFlyLine[] {
  return (state.modifierState[ID] as NoFlyLine[] | undefined) ?? [];
}

function coord(sq: Square, axis: 'file' | 'rank'): number {
  return axis === 'file' ? FILES.indexOf(sq[0]) : Number(sq[1]) - 1;
}

/** The line the king closes when this target is clicked: the king's file or rank through it. */
function lineFor(kingSquare: Square, target: Square): { axis: 'file' | 'rank'; index: number } {
  return target[0] === kingSquare[0]
    ? { axis: 'file', index: coord(kingSquare, 'file') }
    : { axis: 'rank', index: coord(kingSquare, 'rank') };
}

/** Squares on closed lines, with the side that declared each. For the board tint. */
export function getNoFlySquares(state: GameState): Map<Square, Color> {
  const result = new Map<Square, Color>();
  for (const line of lines(state)) {
    for (let i = 0; i < 8; i++) {
      const sq = (line.axis === 'file' ? `${FILES[line.index]}${i + 1}` : `${FILES[i]}${line.index + 1}`) as Square;
      result.set(sq, line.color);
    }
  }
  return result;
}

/**
 * MOD-C001: the king closes his own file or rank. For 3 enemy turns no enemy
 * piece may land on it or cross it. Pigeons cannot read, so they ignore it.
 */
export const noFlyZoneDef: ModifierDefinition = {
  id: ID,
  name: 'I Hereby Declare',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Declare No-Fly Zone',
    hint: 'Click a square on the king\'s column or row. Enemies cannot land on or cross it for 3 of their turns.',
    pieceTypes: ['king'],
    cooldown: 8,
    getTargets(_state, king) {
      const targets: Square[] = [];
      for (let i = 0; i < 8; i++) {
        const onFile = `${king.square[0]}${i + 1}` as Square;
        const onRank = `${FILES[i]}${king.square[1]}` as Square;
        if (onFile !== king.square) targets.push(onFile);
        if (onRank !== king.square) targets.push(onRank);
      }
      return targets;
    },
    apply(state, move) {
      const { axis, index } = lineFor(move.from, move.to);
      const color = move.playerColor;
      const next = cloneState(state);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock += 1;
      next.modifierState[ID] = [
        ...lines(state).filter(line => line.color !== color),
        { color, axis, index, turnsLeft: NO_FLY_TURNS },
      ];
      const name = axis === 'file' ? `the ${FILES[index]}-file` : `rank ${index + 1}`;
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'I HEREBY DECLARE',
          message: `The ${color} king bans all enemy flights over ${name}.`,
        }),
      };
    },
    notation(_state, move) {
      const { axis, index } = lineFor(move.from, move.to);
      return `K=NFZ(${axis === 'file' ? FILES[index] : index + 1})`;
    },
  },

  onPreMoveValidate(state, move) {
    const piece = state.pieces.get(move.from);
    if (!piece || piece.type === 'pigeon') return { blocked: false };
    for (const line of lines(state)) {
      if (line.color === move.playerColor) continue;
      const from = coord(move.from, line.axis) - line.index;
      const to = coord(move.to, line.axis) - line.index;
      if (to === 0 || Math.sign(from) * Math.sign(to) < 0) {
        return { blocked: true, reason: 'I Hereby Declare: the king has banned crossing that line.' };
      }
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    const current = lines(state);
    if (current.length === 0) return state;
    // state.turn is about to move, so the other side just used a turn.
    const kept = current
      .map(line => (line.color === state.turn ? { ...line, turnsLeft: line.turnsLeft - 1 } : line))
      .filter(line => line.turnsLeft > 0);
    const next = cloneState(state);
    next.modifierState[ID] = kept;
    return next;
  },
};
