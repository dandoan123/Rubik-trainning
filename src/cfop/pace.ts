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
export const formatEstimate = (seconds: number) => (seconds < 60 ? seconds.toFixed(1) : clock(Math.round(seconds)));

/** "sub-20", or "sub-1:05" past the minute. */
export const subLabel = (seconds: number) => `sub-${seconds < 59 ? subOf(seconds) : clock(subOf(seconds))}`;
