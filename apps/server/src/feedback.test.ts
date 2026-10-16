import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createFeedbackStore, feedbackAsMarkdown } from './feedback';

describe('feedback store', () => {
  it('keeps feedback, prints open items as Markdown, and marks them done', () => {
    const store = createFeedbackStore(new DatabaseSync(':memory:'));
    const id = store.add({ kind: 'bug', message: 'Lava ate my king', context: { screen: 'game', moves: 12 }, userId: null, username: 'alice' });
    const markdown = feedbackAsMarkdown(store.list('open'));
    expect(markdown).toContain(`#${id} · bug · alice`);
    expect(markdown).toContain('Lava ate my king');
    expect(markdown).toContain('- moves: 12');
    expect(store.markDone([id])).toBe(1);
    expect(feedbackAsMarkdown(store.list('open'))).toBe('No open feedback.');
  });
});
