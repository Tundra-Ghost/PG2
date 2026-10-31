import type { ModifierDefinition } from '../types';
import type { Color, GameState, PieceType, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { isInCheck } from '../../engine/moveGenerator';
import { affectsColor } from '../owner';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.moneyball;
const FILES = 'abcdefgh';
/** Most Mercenary Tokens a side can hold. */
export const MAX_TOKENS = 3;

interface Ledger {
  tokens: number;
  /** Lost pieces that can be bought back, oldest first. */
  pool: PieceType[];
}

const LETTER: Partial<Record<PieceType, string>> = {
  queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P', chancellor: 'C', royal_guard: 'G', pigeon: 'H',
};

function ledgers(state: GameState): Partial<Record<Color, Ledger>> {
  return (state.modifierState[ID] as Partial<Record<Color, Ledger>> | undefined) ?? {};
}

export function getMoneyballLedger(state: GameState, color: Color): Ledger {
  return ledgers(state)[color] ?? { tokens: 0, pool: [] };
}

function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

function dropState(state: GameState, color: Color, type: PieceType, to: Square): GameState {
  const next = cloneState(state);
  next.pieces.set(to, {
    id: `moneyball-${color}-${type}-${state.moveHistory.length + 1}`,
    type,
    color,
    square: to,
    cooldowns: {},
  });
  return next;
}

/** Pool types that may land on `to`: empty, on the board, no pawn on rank 1 or 8, no check. */
function dropChoices(state: GameState, color: Color, to: Square): PieceType[] {
  const ledger = getMoneyballLedger(state, color);
  if (ledger.tokens < 1 || state.pieces.has(to) || state.tiles.get(to)?.isVoid) return [];
  const types = [...new Set(ledger.pool)];
  return types.filter(type => {
    if (type === 'pawn' && (to[1] === '1' || to[1] === '8')) return false;
    return !isInCheck(dropState(state, color, type, to), opponent(color));
  });
}

function allSquares(): Square[] {
  const result: Square[] = [];
  for (const f of FILES) for (let r = 1; r <= 8; r++) result.push(`${f}${r}` as Square);
  return result;
}

/**
 * MOD-E008: lost pieces earn Mercenary Tokens. The owner's King spends one
 * (it costs the turn) to drop a lost piece back onto an empty square.
 */
export const moneyballDef: ModifierDefinition = {
  id: ID,
  name: 'Moneyball (We\'ll Buy Them Back)',
  category: 'E',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Buy back',
    hint: 'Spend a Mercenary Token to drop a lost piece on an empty square. It cannot give check. Costs your turn.',
    pieceTypes: ['king'],
    cooldown: 0,
    getTargets(state, king) {
      return allSquares().filter(sq => dropChoices(state, king.color, sq).length > 0);
    },
    getChoices(state, king, to) {
      return dropChoices(state, king.color, to);
    },
    status(state, king) {
      const tokens = getMoneyballLedger(state, king.color).tokens;
      return `${tokens} token${tokens === 1 ? '' : 's'}`;
    },
    apply(state, move) {
      const color = move.playerColor;
      const type = move.dropType ?? dropChoices(state, color, move.to)[0];
      const ledger = getMoneyballLedger(state, color);
      const pool = [...ledger.pool];
      pool.splice(pool.indexOf(type), 1);
      const next = dropState(state, color, type, move.to);
      next.modifierState = {
        ...next.modifierState,
        [ID]: { ...ledgers(state), [color]: { tokens: ledger.tokens - 1, pool } },
      };
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'Moneyball',
          squares: [move.to],
          message: `The ${color} side buys back a ${type.replace('_', ' ')} on ${move.to}.`,
        }),
      };
    },
    notation(_state, move) {
      return `${LETTER[move.dropType ?? 'pawn'] ?? ''}@${move.to}`;
    },
  },

  onPreMoveValidate(state, move) {
    if (move.ability !== ID) return { blocked: false };
    const choices = dropChoices(state, move.playerColor, move.to);
    if (move.dropType ? choices.includes(move.dropType) : choices.length > 0) return { blocked: false };
    return { blocked: true, reason: 'That piece cannot be dropped there. A drop may not give check.' };
  },

  onCapture(state, _move, captured) {
    if (captured.type === 'king' || !affectsColor(state, ID, captured.color)) return state;
    const ledger = getMoneyballLedger(state, captured.color);
    const tokens = Math.min(MAX_TOKENS, ledger.tokens + 1);
    const next = cloneState(state);
    next.modifierState = {
      ...next.modifierState,
      [ID]: { ...ledgers(state), [captured.color]: { tokens, pool: [...ledger.pool, captured.type] } },
    };
    if (tokens === ledger.tokens) return next;
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Moneyball',
      message: `A Mercenary Token for ${captured.color} (${tokens}/${MAX_TOKENS}).`,
    });
  },
};
