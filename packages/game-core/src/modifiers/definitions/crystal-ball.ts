import type { ModifierDefinition } from '../types';
import type { Color, GameState, Move, Square } from '../../engine/types';
import { applyMove, passTurn } from '../../engine/gameLoop';
import { getVisibleSquares } from '../../engine/visibility';
import { isInCheck } from '../../engine/moveGenerator';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { allValidMoves } from './you-died';

const ID = MODIFIER_IDS.crystalBall;
/** How far the ball looks ahead: 2 rounds. */
export const FORECAST_PLIES = 4;

/** Cards whose board events come on a timer. The draft offers Crystal Ball once one is picked. */
export const TIMED_EVENT_CARDS: readonly string[] = [
  MODIFIER_IDS.floorIsLava,
  MODIFIER_IDS.stormClosesIn,
  MODIFIER_IDS.gravitationalAnomaly,
  MODIFIER_IDS.hatofulGambit,
  MODIFIER_IDS.theBirds,
  MODIFIER_IDS.tideGoesIn,
  MODIFIER_IDS.cropCircles,
  MODIFIER_IDS.smokeCloud,
];

export interface ForecastMark {
  /** The event's title, such as "Storm". */
  title: string;
  /** Rounds from now: 1 or 2. */
  rounds: number;
}

/** A quiet stand-in move for the look-ahead: no capture if it can help it. */
function standInMove(state: GameState): Move | null {
  const moves = allValidMoves(state);
  return moves.find(m => !state.pieces.has(m.to) && !m.isEnPassant) ?? moves[0] ?? null;
}

/** The parts of a tile that timed events change (never a hidden vent). */
function tileKey(state: GameState, sq: Square): string {
  const tile = state.tiles.get(sq);
  if (!tile) return '';
  const flock = tile.barrier?.kind === 'flock';
  return JSON.stringify([tile.effects, tile.storm, flock, tile.flockWarning, tile.tide, tile.cropCircle]);
}

const cache = new WeakMap<GameState, Map<Color, Map<Square, ForecastMark>>>();

/**
 * Squares where a timed event lands within the next 2 rounds, for `viewer`
 * with Crystal Ball (empty without it). The game is played ahead on a copy
 * with stand-in moves, using the same seed, so it shows what happens if
 * nothing changes. A move that changes the seed or the board can change it.
 * Squares that only show pieces are kept to what the viewer can see.
 */
export function getForecast(state: GameState, viewer: Color): Map<Square, ForecastMark> {
  const marks = new Map<Square, ForecastMark>();
  if (!affectsColor(state, ID, viewer) || state.status !== 'active') return marks;
  const known = cache.get(state)?.get(viewer);
  if (known) return known;
  const timed = new Set(TIMED_EVENT_CARDS.filter(id => state.activeModifiers.some(mod => mod.id === id)));
  const visible = getVisibleSquares(state, viewer);
  let sim = state;
  for (let ply = 1; ply <= FORECAST_PLIES && sim.status === 'active'; ply++) {
    const before = sim;
    const move = standInMove(sim);
    sim = move ? applyMove(sim, move) : isInCheck(sim, sim.turn) ? sim : passTurn(sim);
    if (sim === before) break;
    const rounds = Math.ceil(ply / 2);
    const events = sim.eventHistory.slice(before.eventHistory.length).filter(e => timed.has(e.modifierId));
    if (events.length === 0) continue;
    const title = events[0].title;
    for (const sq of new Set([...before.tiles.keys(), ...sim.tiles.keys()])) {
      if (!marks.has(sq) && tileKey(before, sq) !== tileKey(sim, sq)) marks.set(sq, { title, rounds });
    }
    for (const event of events) {
      for (const sq of event.squares ?? []) {
        if (!marks.has(sq) && (!visible || visible.has(sq))) marks.set(sq, { title: event.title, rounds });
      }
    }
  }
  const byViewer = cache.get(state) ?? new Map();
  byViewer.set(viewer, marks);
  cache.set(state, byViewer);
  return marks;
}

/**
 * MOD-D017: the owner sees where timed events land up to 2 rounds ahead.
 * The draft only offers it once a timed-event card is picked (draft/rules.ts).
 */
export const crystalBallDef: ModifierDefinition = {
  id: ID,
  name: 'Crystal Ball',
  category: 'D',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
