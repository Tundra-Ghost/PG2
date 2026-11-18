/** Gap kept between a tooltip and the edge of the screen, in px. */
export const TOOLTIP_MARGIN = 8;

/**
 * How far to move a centred tooltip sideways so it stays on screen.
 * `left` and `right` are its edges before any shift. Positive moves right.
 */
export function tooltipShiftFor(left: number, right: number, viewportWidth: number, margin = TOOLTIP_MARGIN): number {
  if (left < margin) return Math.round(margin - left);
  if (right > viewportWidth - margin) return Math.round(viewportWidth - margin - right);
  return 0;
}
