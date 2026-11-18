import { describe, expect, it } from 'vitest';
import { tooltipShiftFor } from './tooltipShift';

describe('tooltipShiftFor', () => {
  it('leaves a tooltip that fits alone', () => {
    expect(tooltipShiftFor(100, 250, 392)).toBe(0);
  });

  it('pushes one off the left edge back on screen', () => {
    expect(tooltipShiftFor(-55, 95, 392)).toBe(63);
  });

  it('pulls one off the right edge back on screen', () => {
    expect(tooltipShiftFor(300, 450, 392)).toBe(-66);
  });
});
