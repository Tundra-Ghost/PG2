import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { ALL_DIRECTIONS, offset } from '../../engine/push';
import { revealBumped, shownSlideSquares, slidePieceSafely, type Bumped } from '../../engine/conveyor';
import { getHiddenPieceIds, getVisibleSquares } from '../../engine/visibility';
import { MODIFIER_IDS } from '../ids';
import { getShownType } from './sus';
import { timedPhase, timedStart, type TimedSchedule } from '../timed';

const ID = MODIFIER_IDS.shakeItOff;

/**
 * Every 10 rounds, shown 1 round ahead. Counted in rounds (fullMoveNumber),
 * not turns, so an extra turn never moves the quake before Black's move:
 * arrows in round 10, the quake at the first turn start of round 11.
 */
export const QUAKE: TimedSchedule = { every: 10, stay: 1, warning: 1 };

/** One piece's planned shake: one square by df files and dr ranks. */
export interface Shake {
  id: string;
  df: number;
  dr: number;
}

interface QuakeState {
  /** The round of the quake these arrows are for. */
  plannedFor?: number;
  shakes?: Shake[];
  /** The round of the last quake, so it happens once. */
  lastQuake?: number;
}

function quakeState(state: GameState): QuakeState {
  return (state.modifierState[ID] as QuakeState | undefined) ?? {};
}

/**
 * True if an arrow this way stays on the board and does not take a pawn to
 * rank 1 or 8. Uses the type the opponent sees (Sus), so arrows never give a disguise away.
 */
function canShake(state: GameState, piece: Piece, df: number, dr: number): boolean {
  const to = offset(piece.square, df, dr);
  if (!to) return false;
  const shown = getShownType(state, piece, piece.color === 'white' ? 'black' : 'white');
  return !(shown === 'pawn' && (to[1] === '1' || to[1] === '8'));
}

/**
 * MOD-A018: the planned shakes with each piece's square, for the board's
 * arrows. Pieces `viewer` cannot see (hidden or in fog) are left out.
 */
export function getQuakeArrows(state: GameState, viewer: Color | null): { square: Square; df: number; dr: number }[] {
  const shakes = quakeState(state).shakes;
  if (!shakes?.length) return [];
  const byId = new Map([...state.pieces.values()].map(p => [p.id, p]));
  const hidden = viewer ? getHiddenPieceIds(state, viewer) : new Set<string>();
  const visible = viewer ? getVisibleSquares(state, viewer) : null;
  const out: { square: Square; df: number; dr: number }[] = [];
  for (const shake of shakes) {
    const piece = byId.get(shake.id);
    if (!piece || hidden.has(piece.id)) continue;
    if (visible && piece.color !== viewer && !visible.has(piece.square)) continue;
    // A piece that moved since may now face the edge (or a pawn its last rank): no arrow, it stays.
    if (!canShake(state, piece, shake.df, shake.dr)) continue;
    out.push({ square: piece.square, df: shake.df, dr: shake.dr });
  }
  return out;
}

/**
 * MOD-A018: every 10 rounds an earthquake moves every non-King piece one
 * square its own way. The arrows are picked with the game seed and shown one
 * round ahead. A piece moves only if that square is empty and on the board.
 * Slides follow engine/conveyor.ts: never a capture, never a King into check
 * or a new checker. Pieces that arrive after the arrows are picked stay put.
 */
export const shakeItOffDef: ModifierDefinition = {
  id: ID,
  name: 'Shake It Off',
  category: 'A',
  pointCost: 4,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'shared',

  onTurnStart(state) {
    if (state.status !== 'active') return state;
    const round = state.flags.fullMoveNumber;
    const phase = timedPhase(round, QUAKE);
    const start = timedStart(round, QUAKE);
    const memo = quakeState(state);

    if (phase === 'warning' && memo.plannedFor !== start) {
      const shakes: Shake[] = [];
      let prng = state.prngState;
      const pieces = [...state.pieces.values()].filter(p => p.type !== 'king').sort((a, b) => (a.square < b.square ? -1 : 1));
      for (const piece of pieces) {
        const dirs = ALL_DIRECTIONS.filter(([df, dr]) => canShake(state, piece, df, dr));
        if (dirs.length === 0) continue;
        const [idx, nextPrng] = prngPickIndex(prng, dirs.length);
        prng = nextPrng;
        shakes.push({ id: piece.id, df: dirs[idx][0], dr: dirs[idx][1] });
      }
      const next: GameState = { ...state, prngState: prng, modifierState: { ...state.modifierState, [ID]: { ...memo, plannedFor: start, shakes } satisfies QuakeState } };
      return appendGameEvent(next, {
        ply: state.moveHistory.length + 1,
        type: 'modifier',
        modifierId: ID,
        title: 'Tremor',
        message: 'The ground trembles. Next round an earthquake moves every piece but the Kings one square the way its arrow points.',
      });
    }

    if (phase !== 'active' || memo.lastQuake === start) return state;
    let next = cloneState(state);
    const shakes = memo.plannedFor === start ? memo.shakes ?? [] : [];
    next.modifierState = { ...next.modifierState, [ID]: { lastQuake: start } satisfies QuakeState };
    const byId = () => new Map([...next.pieces.values()].map(p => [p.id, p]));
    const bumped: Bumped = new Set();
    const done = new Set<string>();
    const moved: Square[] = [];
    // Repeat until nothing more can move, so a piece follows one that moved out of its way.
    let changed = true;
    while (changed) {
      changed = false;
      const pieces = byId();
      for (const shake of shakes) {
        const piece = pieces.get(shake.id);
        if (!piece || piece.type === 'king' || done.has(piece.id)) continue;
        const to = offset(piece.square, shake.df, shake.dr);
        if (slidePieceSafely(next, piece.square, to)) {
          done.add(piece.id);
          moved.push(to!);
          changed = true;
        }
      }
    }
    // Pieces still waiting: reveal any hidden piece that blocks them.
    const pieces = byId();
    for (const shake of shakes) {
      const piece = pieces.get(shake.id);
      if (piece && piece.type !== 'king' && !done.has(piece.id)) slidePieceSafely(next, piece.square, offset(piece.square, shake.df, shake.dr), bumped);
    }
    next = revealBumped(next, bumped);
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'Earthquake',
      // Count only moves the opponent may see, so a hidden piece's shake is never given away.
      message: shownSlideSquares(next, moved).length > 0 ? 'Earthquake! Pieces shake one square the way their arrows point.' : 'Earthquake! Nothing had room to move.',
      squares: shownSlideSquares(next, moved),
    });
  },

  /** Online: arrows on enemy pieces the viewer cannot see are not sent. */
  redactState(state, viewer) {
    const memo = quakeState(state);
    if (!memo.shakes) return memo;
    const shown = new Set(getQuakeArrows(state, viewer).map(a => state.pieces.get(a.square)?.id));
    return { ...memo, shakes: memo.shakes.filter(s => shown.has(s.id)) };
  },
};
