import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { cleanAnswers, createSurveyStore, surveySummary } from './survey';

describe('post-game surveys', () => {
  it('keep well-formed answers and drop the rest', () => {
    expect(
      cleanAnswers([
        { id: 'fun', kind: 'scale', question: 'How fun?', answer: 4 },
        { id: 'fun2', kind: 'scale', question: 'How fun?', answer: 9 },
        { id: 'again', kind: 'choice', question: 'Again?', answer: '  Yes ' },
        { id: 'confusing', kind: 'multi', question: 'Confusing?', answer: ['Vent Tiles', 7, ''] },
        { id: 'notes', kind: 'text', question: 'Anything else?', answer: '   ' },
        { id: 'weird', kind: 'essay', question: '?', answer: 'x' },
        'nonsense',
      ]),
    ).toEqual([
      { id: 'fun', kind: 'scale', question: 'How fun?', answer: 4 },
      { id: 'again', kind: 'choice', question: 'Again?', answer: 'Yes' },
      { id: 'confusing', kind: 'multi', question: 'Confusing?', answer: ['Vent Tiles'] },
    ]);
  });

  it('summarise responses per question', () => {
    const store = createSurveyStore(new DatabaseSync(':memory:'));
    const add = (username: string, fun: number, confusing: string[], note?: string) =>
      store.add({
        survey: 'post-game-v1',
        userId: null,
        username,
        context: { mode: 'quick', bot: 'chick', result: 'win' },
        answers: [
          { id: 'fun', kind: 'scale', question: 'How fun was that game?', answer: fun },
          { id: 'confusing', kind: 'multi', question: 'Any modifiers confusing?', answer: confusing },
          ...(note ? [{ id: 'notes', kind: 'text' as const, question: 'Anything else?', answer: note }] : []),
        ],
      });
    add('alice', 5, ['Vent Tiles']);
    add('bob', 3, ['Vent Tiles', 'The Floor Is Lava'], 'Lava ate my king');

    const summary = surveySummary(store.list());
    expect(summary).toContain('# Post-game surveys (2 responses)');
    expect(summary).toContain('Average **4.0 / 5**');
    expect(summary).toContain('- Vent Tiles: 2');
    expect(summary).toContain('- "Lava ate my king" (bob; quick, chick, win)');
  });
});
