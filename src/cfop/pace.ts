// How long a solution would take someone to perform.
//
// A solution's effort is counted in beats (one plain R or U flick is one beat, see fingertrick.ts).
// A solver's pace is beats per second averaged over a whole solve, pauses included, so the time is
// simply effort divided by pace.

/**
 * Effort of an ordinary hand-made CFOP solve: about 60 turns, a few of them awkward, and a few
 * whole-cube rotations. It links a solver's average time to a pace.
 */
const TYPICAL_EFFORT = 70;

/** Paces on offer, slowest first. */
export const PACES: readonly number[] = [1, 1.5, 2, 3, 4, 6, 8];

/** The average solve time, in whole seconds, of someone turning at this pace. */
export const typicalSeconds = (pace: number) => Math.round(TYPICAL_EFFORT / pace);

/** The pace of someone whose solves average this long. */
export const paceOf = (averageMs: number) => TYPICAL_EFFORT / (averageMs / 1000);

export const secondsFor = (effort: number, pace: number) => effort / pace;

/** The "sub" a time falls under: 19.6 seconds is sub-20. */
export const subOf = (seconds: number) => Math.floor(seconds) + 1;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** An estimate is only good to a tenth of a second, and to a second past the minute. */
const shown = (seconds: number) => (seconds < 59.95 ? Math.round(seconds * 10) / 10 : Math.round(seconds));

export const formatEstimate = (seconds: number) => (shown(seconds) < 60 ? shown(seconds).toFixed(1) : clock(shown(seconds)));

/**
 * "sub-20", or "sub-1:05" past the minute. It goes by the time as displayed, so that 8.96 seconds,
 * shown as 9.0, reads sub-10 rather than a contradictory sub-9.
 */
export function subLabel(seconds: number) {
  const sub = subOf(shown(seconds));
  return `sub-${sub < 60 ? sub : clock(sub)}`;
}
