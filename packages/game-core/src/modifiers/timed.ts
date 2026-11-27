/**
 * The timed-event pattern of The Birds (MOD-A009), shared by cards that come
 * and go on a schedule: every `every` steps an event starts, stays `stay`
 * steps, and is shown `warning` steps ahead. A step is a turn (turnNumber) or
 * a round (fullMoveNumber), whichever the card passes in. Everything is worked
 * out from that number, so a second onTurnStart call for the same turn changes nothing.
 */
export interface TimedSchedule {
  every: number;
  stay: number;
  warning: number;
}

export type TimedPhase = 'warning' | 'active' | null;

/** The phase on this turn or round. The first event starts on step `every + 1`. */
export function timedPhase(turnNumber: number, { every, stay, warning }: TimedSchedule): TimedPhase {
  const k = turnNumber - 1;
  if (k >= every && k % every < stay) return 'active';
  if (k + warning >= every && (k % every) >= every - warning) return 'warning';
  return null;
}

/** The step the current event started on, or the next one starts on. */
export function timedStart(turnNumber: number, schedule: TimedSchedule): number {
  const k = turnNumber - 1;
  const n = timedPhase(turnNumber, schedule) === 'active' ? Math.floor(k / schedule.every) : Math.ceil(k / schedule.every);
  return n * schedule.every + 1;
}
