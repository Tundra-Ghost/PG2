import { describe, expect, it } from 'vitest';
import { isTextField, shouldCloseOnEscape } from './escapeClose';

describe('shouldCloseOnEscape', () => {
  it('closes on Escape when nothing is typed', () => {
    expect(shouldCloseOnEscape('Escape', [])).toBe(true);
    expect(shouldCloseOnEscape('Escape', [{ tagName: 'TEXTAREA', value: '' }])).toBe(true);
  });
  it('ignores other keys', () => {
    expect(shouldCloseOnEscape('Enter', [])).toBe(false);
  });
  it('is not blocked by a volume slider or checkbox value', () => {
    expect(
      shouldCloseOnEscape('Escape', [
        { tagName: 'INPUT', type: 'range', value: '50' },
        { tagName: 'INPUT', type: 'checkbox', value: 'on' },
      ]),
    ).toBe(true);
  });
  it('keeps typed text safe wherever focus is', () => {
    expect(shouldCloseOnEscape('Escape', [{ tagName: 'TEXTAREA', value: 'bug report' }])).toBe(false);
    expect(shouldCloseOnEscape('Escape', [{ tagName: 'input', type: 'email', value: 'me@x' }])).toBe(false);
    expect(shouldCloseOnEscape('Escape', [{ tagName: 'INPUT', value: 'name' }])).toBe(false);
  });
});

describe('isTextField', () => {
  it('knows text fields from other inputs', () => {
    expect(isTextField({ tagName: 'INPUT', type: 'password' })).toBe(true);
    expect(isTextField({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTextField({ tagName: 'BUTTON' })).toBe(false);
  });
});
