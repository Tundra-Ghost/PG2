import { describe, expect, it } from 'vitest';
import { MODIFIER_IDS, createOnlineDraft, draftFinish, draftPick, type OnlineDraft } from '@pigeon-chess/game-core';
import { draftViewFor } from './draftView';

function unwrap(res: { ok: true; draft: OnlineDraft } | { ok: false; error: string }): OnlineDraft {
  if (!res.ok) throw new Error(res.error);
  return res.draft;
}

describe('draftViewFor', () => {
  it('shows White picking first and Black waiting', () => {
    const draft = createOnlineDraft();
    expect(draftViewFor(draft, 'white').turn).toBe('player');
    expect(draftViewFor(draft, 'black').turn).toBe('opponent');
  });

  it('puts each side’s picks on the right side of the table', () => {
    const draft = unwrap(draftPick(createOnlineDraft(), 'white', MODIFIER_IDS.gerald));
    expect(draftViewFor(draft, 'white')).toMatchObject({ myPicks: [MODIFIER_IDS.gerald], theirPicks: [], turn: 'opponent' });
    expect(draftViewFor(draft, 'black')).toMatchObject({ myPicks: [], theirPicks: [MODIFIER_IDS.gerald], turn: 'player' });
  });

  it('marks a finished side as done and the draft as over when both are', () => {
    const oneDone = unwrap(draftFinish(createOnlineDraft(), 'white'));
    expect(draftViewFor(oneDone, 'white').iAmDone).toBe(true);
    expect(draftViewFor(oneDone, 'black').turn).toBe('player');
    const bothDone = unwrap(draftFinish(oneDone, 'black'));
    expect(draftViewFor(bothDone, 'black').turn).toBe('done');
  });
});
