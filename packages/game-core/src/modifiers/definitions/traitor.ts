import type { ModifierDefinition } from '../types';
import type { Color, GameState, Piece } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex, prngStep } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.traitor;

/** Defection can start once both sides have made 10 moves. */
export const TRAITOR_EARLIEST_TURN = 21;
/** Chance per owner turn, once eligible, that a traitor is chosen. */
export const TRAITOR_CHANCE = 0.25;

const VALUE: Partial<Record<Piece['type'], number>> = {
  queen: 9, chancellor: 8, rook: 5, bishop: 3, knight: 3, pawn: 1,
};

type TraitorPhase = 'waiting' | 'warned' | 'done';
type TraitorState = Partial<Record<Color, { phase: TraitorPhase; pieceId?: string }>>;

function readState(state: GameState): TraitorState {
  return (state.modifierState[ID] as TraitorState | undefined) ?? {};
}

function writeState(state: GameState, color: Color, value: TraitorState[Color]): void {
  state.modifierState[ID] = { ...readState(state), [color]: value };
}

function label(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

/** Highest-value non-king pieces of `color`; one is picked at random. */
function pickTraitor(state: GameState, color: Color, prngState: number): [Piece | null, number] {
  const candidates = Array.from(state.pieces.values()).filter(p => p.color === color && p.type !== 'king');
  if (candidates.length === 0) return [null, prngState];
  const top = Math.max(...candidates.map(p => VALUE[p.type] ?? 0));
  const best = candidates.filter(p => (VALUE[p.type] ?? 0) === top);
  const [idx, next] = prngPickIndex(prngState, best.length);
  return [best[idx], next];
}

function warn(state: GameState, color: Color): GameState {
  const [roll, afterRoll] = prngStep(state.prngState);
  const next = cloneState(state);
  next.prngState = afterRoll;
  if (roll >= TRAITOR_CHANCE) return next;

  const [traitor, afterPick] = pickTraitor(next, color, afterRoll);
  next.prngState = afterPick;
  if (!traitor) return next;

  next.pieces.set(traitor.square, { ...traitor, isTraitor: true });
  writeState(next, color, { phase: 'warned', pieceId: traitor.id });
  return appendGameEvent(next, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: ID,
    title: 'Traitor',
    message: `${label(color)}'s ${traitor.type} on ${traitor.square} is acting sus. It defects next turn.`,
  });
}

function defect(state: GameState, color: Color, pieceId: string): GameState {
  const traitor = Array.from(state.pieces.values()).find(p => p.id === pieceId);
  const next = cloneState(state);
  if (!traitor || traitor.color !== color) {
    // Captured or traded before it could defect. Look for a new one later.
    writeState(next, color, { phase: 'waiting' });
    return next;
  }

  const opponent: Color = color === 'white' ? 'black' : 'white';
  next.pieces.set(traitor.square, { ...traitor, color: opponent, isTraitor: false });
  if (traitor.type === 'rook') {
    const homeRank = color === 'white' ? '1' : '8';
    if (traitor.square === `h${homeRank}`) next.flags.castlingRights[color].kingSide = false;
    if (traitor.square === `a${homeRank}`) next.flags.castlingRights[color].queenSide = false;
  }
  writeState(next, color, { phase: 'done' });

  const remaining = Array.from(next.pieces.values()).filter(p => p.color === color).length;
  return appendGameEvent(next, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: ID,
    title: 'Traitor',
    message: `${label(color)}'s ${traitor.type} was The Traitor. ${remaining} pieces remain.`,
  });
}

export const traitorDef: ModifierDefinition = {
  id: ID,
  name: 'They Were The Traitor',
  category: 'B',
  pointCost: -3,
  curseRating: 3,
  activeFor: 'both',
  draftScope: 'owned',

  onTurnStart(state) {
    const color = state.turn;
    if (!affectsColor(state, ID, color)) return state;

    const mine = readState(state)[color] ?? { phase: 'waiting' as const };
    if (mine.phase === 'done') return state;
    if (mine.phase === 'warned' && mine.pieceId) return defect(state, color, mine.pieceId);
    if (state.turnNumber < TRAITOR_EARLIEST_TURN) return state;
    return warn(state, color);
  },
};
