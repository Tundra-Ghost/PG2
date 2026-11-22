import { describe, expect, it } from 'vitest';
import { shouldCloseOnEscape } from './escapeClose';

describe('shouldCloseOnEscape', () => {
  it('closes on Escape from the page', () => {
    expect(shouldCloseOnEscape('Escape', null)).toBe(true);
    expect(shouldCloseOnEscape('Escape', { tagName: 'BUTTON' })).toBe(true);
  });
  it('ignores other keys', () => {
    expect(shouldCloseOnEscape('Enter', null)).toBe(false);
  });
  it('closes from an empty text field', () => {
    expect(shouldCloseOnEscape('Escape', { tagName: 'TEXTAREA', value: '' })).toBe(true);
  });
  it('keeps typed text safe', () => {
    expect(shouldCloseOnEscape('Escape', { tagName: 'TEXTAREA', value: 'bug report' })).toBe(false);
    expect(shouldCloseOnEscape('Escape', { tagName: 'input', value: 'me@x' })).toBe(false);
  });
});
