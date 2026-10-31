import type { ModifierDefinition } from '../types';
import type { GameState, Move, Square, TileState } from '../../engine/types';
import { prngPickIndex, prngStep } from '../../engine/prng';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.cordycepticSpread;
const FILES = 'abcdefgh';

/** A new Infected tile appears every 5 rounds (10 plies). */
export const INFECTION_SPAWN_PLIES = 10;
/** Each Infected tile spreads to a neighbour with this chance, once per round. */
export const INFECTION_SPREAD_CHANCE = 0.25;

const SLIDERS = new Set(['rook', 'bishop', 'queen', 'chancellor']);
const CLEANSERS = new Set(['bishop', 'queen']);

interface SpreadState {
  /** Piece id → rounds it has stood still on an Infected tile. */
  rot: Record<string, number>;
}

const ALL_SQUARES: Square[] = (() => {
  const result: Square[] = [];
  for (const f of FILES) for (let r = 1; r <= 8; r++) result.push(`${f}${r}` as Square);
  return result;
})();

function hasEffect(tile: TileState | undefined, type: 'infected' | 'lava'): boolean {
  return tile?.effects.some(e => e.type === type) ?? false;
}

export function isInfectedSquare(state: GameState, square: Square): boolean {
  return hasEffect(state.tiles.get(square), 'infected');
}

function readRot(state: GameState): Record<string, number> {
  return (state.modifierState[ID] as SpreadState | undefined)?.rot ?? {};
}

/**
 * How far the piece on `square` may move, or null when infection does not
 * slow it. Sliders lose 1 square of reach per round stood still (minimum 1).
 * Pawns lose their double step. Knights and kings only take one step, so
 * they are not slowed.
 */
export function getInfectedReach(state: GameState, square: Square): number | null {
  const piece = state.pieces.get(square);
  if (!piece || !isInfectedSquare(state, square)) return null;
  const rot = readRot(state)[piece.id] ?? 0;
  if (rot <= 0) return null;
  if (piece.type === 'pawn') return 1;
  if (SLIDERS.has(piece.type)) return Math.max(1, 7 - rot);
  return null;
}

function canHost(state: GameState, square: Square): boolean {
  const tile = state.tiles.get(square);
  return !tile?.isVoid && !hasEffect(tile, 'lava') && !hasEffect(tile, 'infected');
}

function infect(state: GameState, square: Square): void {
  const tile = state.tiles.get(square) ?? { square, effects: [] };
  state.tiles.set(square, { ...tile, effects: [...tile.effects, { type: 'infected', turnsRemaining: -1 }] });
}

function cure(state: GameState, square: Square): void {
  const tile = state.tiles.get(square);
  if (!tile) return;
  state.tiles.set(square, { ...tile, effects: tile.effects.filter(e => e.type !== 'infected') });
}

function neighbours(square: Square): Square[] {
  const f = FILES.indexOf(square[0]);
  const r = Number(square[1]);
  const result: Square[] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if (df === 0 && dr === 0) continue;
    const nf = f + df;
    const nr = r + dr;
    if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue;
    result.push(`${FILES[nf]}${nr}` as Square);
  }
  return result;
}

/** Squares a straight or diagonal move crosses, plus where it lands. */
function sweptSquares(from: Square, to: Square): Square[] {
  const df = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
  const dr = Number(to[1]) - Number(from[1]);
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return [];
  const steps = Math.max(Math.abs(df), Math.abs(dr));
  const sf = Math.sign(df);
  const sr = Math.sign(dr);
  const result: Square[] = [];
  for (let i = 1; i <= steps; i++) {
    result.push(`${FILES[FILES.indexOf(from[0]) + sf * i]}${Number(from[1]) + sr * i}` as Square);
  }
  return result;
}

function distance(from: Square, to: Square): number {
  const df = Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0]));
  const dr = Math.abs(Number(from[1]) - Number(to[1]));
  return Math.max(df, dr);
}

export const cordycepticSpreadDef: ModifierDefinition = {
  id: ID,
  name: 'The Cordyceptic Spread',
  category: 'A',
  pointCost: 4,
  curseRating: 1,
  activeFor: 'both',
  draftScope: 'shared',

  onPreMoveValidate(state, move: Move) {
    if (move.ability) return { blocked: false };
    const reach = getInfectedReach(state, move.from);
    if (reach === null || distance(move.from, move.to) <= reach) return { blocked: false };
    return {
      blocked: true,
      reason: `The infection has slowed this piece. It can move ${reach} square${reach === 1 ? '' : 's'}.`,
    };
  },

  onPostMove(state, move) {
    const plies = state.moveHistory.length + 1;
    const mover = state.turn;
    const next = cloneState(state);
    const events: { title: string; squares: Square[]; message: string }[] = [];

    // Lava burns infection away.
    for (const [sq, tile] of next.tiles) {
      if (hasEffect(tile, 'lava') && hasEffect(tile, 'infected')) cure(next, sq);
    }

    // A Bishop or Queen sweeps the infection off every square it crosses.
    const moved = next.pieces.get(move.to);
    if (moved && CLEANSERS.has(moved.type) && !move.ability) {
      const cleared = sweptSquares(move.from, move.to).filter(sq => isInfectedSquare(next, sq));
      for (const sq of cleared) cure(next, sq);
      if (cleared.length > 0) {
        events.push({
          title: 'Infection cleared',
          squares: cleared,
          message: `The ${moved.color} ${moved.type} clears the infection on ${cleared.join(', ')}.`,
        });
      }
    }

    let prng = next.prngState;

    // Once per round, after Black moves, each Infected tile may spread.
    if (plies % 2 === 0) {
      const infected = ALL_SQUARES.filter(sq => isInfectedSquare(next, sq));
      const spread: Square[] = [];
      for (const sq of infected) {
        const [roll, afterRoll] = prngStep(prng);
        prng = afterRoll;
        if (roll >= INFECTION_SPREAD_CHANCE) continue;
        const open = neighbours(sq).filter(n => canHost(next, n));
        if (open.length === 0) continue;
        const [idx, afterPick] = prngPickIndex(prng, open.length);
        prng = afterPick;
        infect(next, open[idx]);
        spread.push(open[idx]);
      }
      if (spread.length > 0) {
        events.push({ title: 'Infection', squares: spread, message: `The infection spreads to ${spread.join(', ')}.` });
      }
    }

    // Every 5 rounds a new Infected tile appears on an empty square.
    if (plies % INFECTION_SPAWN_PLIES === 0) {
      const open = ALL_SQUARES.filter(sq => !next.pieces.has(sq) && canHost(next, sq));
      if (open.length > 0) {
        const [idx, afterPick] = prngPickIndex(prng, open.length);
        prng = afterPick;
        infect(next, open[idx]);
        events.push({ title: 'Infection', squares: [open[idx]], message: `Something grows on ${open[idx]}.` });
      }
    }
    next.prngState = prng;

    // The mover's pieces that stood still on infection rot one round more.
    const oldRot = readRot(state);
    const rot: Record<string, number> = {};
    for (const [sq, piece] of next.pieces) {
      if (!isInfectedSquare(next, sq)) continue;
      const before = oldRot[piece.id] ?? 0;
      if (piece.color !== mover) {
        if (before > 0) rot[piece.id] = before;
      } else if (sq !== move.to) {
        rot[piece.id] = before + 1;
      }
    }
    next.modifierState = { ...next.modifierState, [ID]: { rot } satisfies SpreadState };

    let result = next;
    for (const event of events) {
      result = appendGameEvent(result, { ply: plies, type: 'modifier', modifierId: ID, ...event });
    }
    return result;
  },
};
