import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS, stepForScreen } from './tutorial';

const indexOf = (id: string) => TUTORIAL_STEPS.findIndex(step => step.id === id);

describe('tutorial steps', () => {
  it('moves to the first draft step when the draft opens', () => {
    expect(stepForScreen(indexOf('welcome'), 'draft')).toBe(indexOf('draft-cards'));
  });

  it('moves to the first match step when the match starts', () => {
    expect(stepForScreen(indexOf('draft-start'), 'game')).toBe(indexOf('match-move'));
  });

  it('stays put while Settings is open', () => {
    expect(stepForScreen(indexOf('match-read'), 'settings')).toBe(indexOf('match-read'));
  });

  it('ends when the player leaves the tour', () => {
    expect(stepForScreen(indexOf('match-move'), 'menu')).toBeNull();
    expect(stepForScreen(indexOf('draft-cards'), 'online')).toBeNull();
  });
});
