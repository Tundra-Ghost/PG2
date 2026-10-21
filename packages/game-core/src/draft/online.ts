import type { Color } from '../engine/types';
import { ALL_MODIFIERS } from '../modifiers/data';
import { modifierRegistry } from '../modifiers/registry';
import { getValidOptions, pickBlocker } from './rules';

/**
 * Two-player draft for online rooms (TDD P1-03). The server owns this state
 * and runs every pick through the same rules as the local draft.
 * White picks first, then sides alternate. A side that is done (by choice,
 * or because no legal pick is left) is skipped.
 */
export interface OnlineDraft {
  picks: Record<Color, string[]>;
  done: Record<Color, boolean>;
  /** Whose pick it is, or null once both sides are done. */
  turn: Color | null;
}

export type DraftResult = { ok: true; draft: OnlineDraft } | { ok: false; error: string };

const other = (color: Color): Color => (color === 'white' ? 'black' : 'white');

function implementedIds(): Set<string> {
  return new Set(modifierRegistry.getAll().map(def => def.id));
}

function canPick(draft: OnlineDraft, color: Color): boolean {
  return !draft.done[color] && getValidOptions(draft.picks[color], draft.picks[other(color)], implementedIds()).length > 0;
}

/** Marks sides with no legal pick left as done and works out whose turn it is. */
function settle(draft: OnlineDraft, next: Color): OnlineDraft {
  const done = {
    white: draft.done.white || !canPick(draft, 'white'),
    black: draft.done.black || !canPick(draft, 'black'),
  };
  const turn = !done[next] ? next : !done[other(next)] ? other(next) : null;
  return { ...draft, done, turn };
}

export function createOnlineDraft(): OnlineDraft {
  return settle({ picks: { white: [], black: [] }, done: { white: false, black: false }, turn: 'white' }, 'white');
}

export function draftPick(draft: OnlineDraft, color: Color, modifierId: string): DraftResult {
  if (draft.turn !== color) return { ok: false, error: 'Not your pick.' };
  const card = ALL_MODIFIERS.find(c => c.id === modifierId);
  if (!card) return { ok: false, error: 'Unknown modifier.' };
  const blocker = pickBlocker(card, draft.picks[color], draft.picks[other(color)], implementedIds());
  if (blocker) return { ok: false, error: blocker };
  const picks = { ...draft.picks, [color]: [...draft.picks[color], modifierId] };
  return { ok: true, draft: settle({ ...draft, picks }, other(color)) };
}

/** A side stops picking. The other side keeps picking until it is done too. */
export function draftFinish(draft: OnlineDraft, color: Color): DraftResult {
  if (draft.done[color]) return { ok: false, error: 'Your draft is already done.' };
  const done = { ...draft.done, [color]: true };
  return { ok: true, draft: settle({ ...draft, done }, other(color)) };
}

export function isDraftComplete(draft: OnlineDraft): boolean {
  return draft.turn === null;
}
