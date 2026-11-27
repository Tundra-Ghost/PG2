import type { ModifierDefinition } from '../types';
import type { Color, GameState } from '../../engine/types';
import { appendGameEvent } from '../../engine/gameLoop';
import { fromWire, toWire, type WireGameState } from '../../net/wire';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';

const ID = MODIFIER_IDS.ctrlZ;

interface SideUndo {
  used?: boolean;
  /** The game as it stood just before this side's last move or pass (wire form, JSON-safe). Server only online. */
  snapshot?: WireGameState;
  /** Online copy: there is a snapshot to go back to (the snapshot itself is not sent). */
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

/**
 * MOD-C015: why the side to move cannot press Ctrl+Z now, or null if it can.
 * It needs the card, an unused undo, a finished round to undo (its own move
 * and the reply), and a game still running.
 */
export function ctrlZBlocker(state: GameState): string | null {
  const color = state.turn;
  if (!affectsColor(state, ID, color)) return 'Ctrl+Z is not yours.';
  const mine = read(state)[color];
  if (mine?.used) return 'Ctrl+Z is used up.';
  if (state.status !== 'active') return 'The game is over.';
  if (!mine?.snapshot && !mine?.ready) return 'Nothing to undo yet: make a move first.';
  return null;
}

/** True when the side to move may undo now (for the button). */
export function canCtrlZ(state: GameState): boolean {
  return ctrlZBlocker(state) === null;
}

/**
 * MOD-C015: undo the last round. The game goes back to just before the side
 * to move made its last move, with the seed as it was then, so the same
 * moves bring the same random events. That side moves again. Once per match.
 */
export function ctrlZ(state: GameState): GameState {
  const color = state.turn;
  const undo = read(state);
  if (!canCtrlZ(state) || !undo[color]?.snapshot) return state;
  const restored = fromWire(undo[color]!.snapshot!);
  // The other side's snapshot is newer than the restored game, so it goes; its use is kept.
  const otherColor: Color = color === 'white' ? 'black' : 'white';
  const next: UndoState = { [color]: { used: true } };
  if (undo[otherColor]?.used) next[otherColor] = { used: true };
  const back: GameState = { ...restored, modifierState: { ...restored.modifierState, [ID]: next } };
  return appendGameEvent(back, {
    ply: back.moveHistory.length + 1,
    type: 'modifier',
    modifierId: ID,
    title: 'CTRL+Z',
    message: `${color === 'white' ? 'White' : 'Black'} pressed undo. The last round never happened.`,
  });
}

export const ctrlZDef: ModifierDefinition = {
  id: ID,
  name: 'Ctrl+Z',
  category: 'C',
  pointCost: 4,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  // Each move or pass by an owner that still has its undo saves the game as it stood.
  onTurnAction(state) {
    const color = state.turn;
    const undo = read(state);
    if (!affectsColor(state, ID, color) || undo[color]?.used) return state;
    return {
      ...state,
      modifierState: { ...state.modifierState, [ID]: { ...undo, [color]: { snapshot: toWire(bare(state)) } } },
    };
  },

  // Online: the snapshot holds the whole past board, hidden pieces included. Only whether it is used is sent.
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
