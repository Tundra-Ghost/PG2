import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { createOnlineDraft, draftFinish, draftPick, isDraftComplete, type OnlineDraft } from './online';

function pick(draft: OnlineDraft, color: 'white' | 'black', id: string): OnlineDraft {
  const result = draftPick(draft, color, id);
  if (!result.ok) throw new Error(result.error);
  return result.draft;
}

describe('online draft', () => {
  it('starts with white to pick and alternates', () => {
    let draft = createOnlineDraft();
    expect(draft.turn).toBe('white');
    draft = pick(draft, 'white', MODIFIER_IDS.gerald);
    expect(draft.turn).toBe('black');
    draft = pick(draft, 'black', MODIFIER_IDS.berserker);
    expect(draft.turn).toBe('white');
    expect(draft.picks).toEqual({ white: [MODIFIER_IDS.gerald], black: [MODIFIER_IDS.berserker] });
  });

  it('rejects out-of-turn, unknown and rule-breaking picks', () => {
    const draft = createOnlineDraft();
    expect(draftPick(draft, 'black', MODIFIER_IDS.gerald)).toEqual({ ok: false, error: 'Not your pick.' });
    expect(draftPick(draft, 'white', 'MOD-NOPE')).toEqual({ ok: false, error: 'Unknown modifier.' });

    // A shared modifier can only be claimed once.
    const claimed = pick(draft, 'white', MODIFIER_IDS.floorIsLava);
    const result = draftPick(claimed, 'black', MODIFIER_IDS.floorIsLava);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already claimed/);
  });

  it('lets one side finish early while the other keeps picking', () => {
    let draft = pick(createOnlineDraft(), 'white', MODIFIER_IDS.gerald);
    const finished = draftFinish(draft, 'black');
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    draft = finished.draft;
    expect(draft.turn).toBe('white');
    draft = pick(draft, 'white', MODIFIER_IDS.berserker);
    expect(draft.turn).toBe('white');

    const whiteDone = draftFinish(draft, 'white');
    expect(whiteDone.ok && isDraftComplete(whiteDone.draft)).toBe(true);
    expect(draftFinish(draft, 'black')).toEqual({ ok: false, error: 'Your draft is already done.' });
  });

  it('ends on its own when neither side has a legal pick left', () => {
    let draft = createOnlineDraft();
    for (let i = 0; i < 40 && draft.turn; i++) {
      const side = draft.turn;
      const ids = Object.values(MODIFIER_IDS).filter(id => draftPick(draft, side, id).ok);
      draft = pick(draft, side, ids[0]!);
    }
    expect(isDraftComplete(draft)).toBe(true);
    expect(draft.done).toEqual({ white: true, black: true });
  });
});
