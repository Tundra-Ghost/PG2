import type { ModifierDefinition } from '../types';
import type { Color, GameState } from '../../engine/types';
import { appendGameEvent, playTakenOverTurns } from '../../engine/gameLoop';
import { fromWire, toWire, type WireGameState } from '../../net/wire';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getTouchedPiece } from './commitment-issues';

const ID = MODIFIER_IDS.ctrlZ;

interface SideUndo {
  used?: boolean;
  /** The game at the start of this side's previous turn: where Ctrl+Z goes back to. Server only online. */
  snapshot?: WireGameState;
  /** The game at the start of this side's current (or last) turn. Becomes `snapshot` at its next turn. */
  current?: WireGameState;
  /** Online copy: there is a snapshot to go back to (the snapshots themselves are not sent). */
  ready?: boolean;
}

type UndoState = Partial<Record<Color, SideUndo>>;

function read(state: GameState): UndoState {
  return (state.modifierState[ID] as UndoState | undefined) ?? {};
}

/** The state without any Ctrl+Z data, so snapshots never nest. */
function bare(state: GameState): GameState {
  const { [ID]: _drop, ...modifierState } = state.modifierState;
  return { ...state, modifierState };
}

/** True while `color` is partway through a tempo-token extra turn (its own move came last). */
function midExtraTurn(state: GameState, color: Color): boolean {
  const last = state.moveHistory[state.moveHistory.length - 1];
  return !!last && last.move.playerColor === color && !!last.move.extraTurn;
}

/**
 * MOD-C015: why the side to move cannot press Ctrl+Z now, or null if it can.
 * It needs the card, an unused undo, a finished round to undo (its own move
 * and the reply), no touched piece it must move, and a game still running.
 */
export function ctrlZBlocker(state: GameState): string | null {
  const color = state.turn;
  if (!affectsColor(state, ID, color)) return 'Ctrl+Z is not yours.';
  const mine = read(state)[color];
  if (mine?.used) return 'Ctrl+Z is used up.';
  if (state.status !== 'active') return 'The game is over.';
  if (!mine?.snapshot && !mine?.ready) return 'Nothing to undo yet: make a move first.';
  if (midExtraTurn(state, color)) return 'Finish your extra move first.';
  if (getTouchedPiece(state, color)) return 'You touched a piece: move it.';
  return null;
}

/** True when the side to move may undo now (for the button). */
export function canCtrlZ(state: GameState): boolean {
  return ctrlZBlocker(state) === null;
}

/**
 * MOD-C015: undo the last round. The game goes back to the start of the
 * side to move's previous turn, with the seed as it was then, so the same
 * moves bring the same random events. That side moves again. A move a card
 * plays on its own (YOU DIED) plays again, the same way. Once per match.
 */
export function ctrlZ(state: GameState): GameState {
  const color = state.turn;
  const undo = read(state);
  if (!canCtrlZ(state) || !undo[color]?.snapshot) return state;
  const restored = fromWire(undo[color]!.snapshot!);
  // The other side's snapshots are newer than the restored game, so they go; its use is kept.
  const otherColor: Color = color === 'white' ? 'black' : 'white';
  const next: UndoState = { [color]: { used: true } };
  if (undo[otherColor]?.used) next[otherColor] = { used: true };
  const back: GameState = { ...restored, modifierState: { ...restored.modifierState, [ID]: next } };
  return playTakenOverTurns(appendGameEvent(back, {
    ply: back.moveHistory.length + 1,
    type: 'modifier',
    modifierId: ID,
    title: 'CTRL+Z',
    message: `${color === 'white' ? 'White' : 'Black'} pressed undo. The last round never happened.`,
  }));
}

export const ctrlZDef: ModifierDefinition = {
  id: ID,
  name: 'Ctrl+Z',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  // At the start of each of the owner's turns: the last turn's save becomes the undo point.
  onTurnReady(state) {
    const color = state.turn;
    const undo = read(state);
    const mine = undo[color] ?? {};
    if (!affectsColor(state, ID, color) || mine.used) return state;
    // Same turn again (a reload), or straight after our own turn (an extra turn, or the
    // other side's turn was skipped): still the same round, so keep the saves.
    const at = mine.current?.turnNumber;
    if (at !== undefined && state.turnNumber - at <= 1) return state;
    const side: SideUndo = { current: toWire(bare(state)), ...(mine.current ? { snapshot: mine.current } : {}) };
    return { ...state, modifierState: { ...state.modifierState, [ID]: { ...undo, [color]: side } } };
  },

  // Online: the snapshots hold the whole past board, hidden pieces included. Only whether it is ready is sent.
  redactState(state) {
    const undo = read(state);
    const out: UndoState = {};
    for (const color of ['white', 'black'] as Color[]) {
      const side = undo[color];
      if (side) out[color] = side.used ? { used: true } : side.snapshot ? { ready: true } : {};
    }
    return out;
  },
};
