// Session statistics the way speedcubing timers report them.

export type Penalty = 'ok' | '+2' | 'dnf';

export interface Solve {
  id: string;
  /** Time on the clock in milliseconds, before any penalty. */
  ms: number;
  penalty: Penalty;
  scramble: string;
  /** When the solve finished (epoch milliseconds). */
  at: number;
  /** For OLL / PLL training scrambles: the case that was scrambled. */
  caseId?: string;
}

/** A result that does not count. Sorts after every real time. */
export const DNF = Infinity;

/** The time a solve counts as, in milliseconds. */
export const resultOf = (solve: Solve) => (solve.penalty === 'dnf' ? DNF : solve.ms + (solve.penalty === '+2' ? 2000 : 0));

/** Plain mean. One DNF makes the whole mean a DNF. */
export function mean(times: readonly number[]): number {
  return times.reduce((sum, time) => sum + time, 0) / times.length;
}

/** How many of the best and of the worst results an average of `count` leaves out: 5%, rounded up. */
export const trimOf = (count: number) => Math.ceil(count * 0.05);

/** Average with the best and worst results left out. A DNF among the counted ones makes it a DNF. */
export function average(times: readonly number[]): number {
  const trim = trimOf(times.length);
  const sorted = [...times].sort((a, b) => a - b);
  return mean(sorted.slice(trim, sorted.length - trim));
}

/** For each position, the mean or average of the `size` results ending there (null until there are enough). */
export function rolling(times: readonly number[], size: number, kind: 'mean' | 'average'): (number | null)[] {
  const reduce = kind === 'mean' ? mean : average;
  return times.map((_, end) => (end + 1 < size ? null : reduce(times.slice(end + 1 - size, end + 1))));
}

export interface StatLine {
  label: string;
  /** Null when the session is too short for this statistic. */
  current: number | null;
  best: number | null;
}

export interface Summary {
  count: number;
  /** Solves that are not DNF. */
  finished: number;
  /** Mean of the finished solves; null without any. */
  mean: number | null;
  lines: StatLine[];
}

const WINDOWS: { label: string; size: number; kind: 'mean' | 'average' }[] = [
  { label: 'mo3', size: 3, kind: 'mean' },
  { label: 'ao5', size: 5, kind: 'average' },
  { label: 'ao12', size: 12, kind: 'average' },
  { label: 'ao50', size: 50, kind: 'average' },
  { label: 'ao100', size: 100, kind: 'average' },
];

const least = (values: readonly (number | null)[]) => {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? Math.min(...known) : null;
};

/** Solves in the order they were done, oldest first. */
export function summarize(solves: readonly Solve[]): Summary {
  const times = solves.map(resultOf);
  const finished = times.filter((time) => time !== DNF);
  const lines: StatLine[] = [{ label: 'single', current: times.at(-1) ?? null, best: least(times) }];
  for (const { label, size, kind } of WINDOWS) {
    const values = rolling(times, size, kind);
    lines.push({ label, current: values.at(-1) ?? null, best: least(values) });
  }
  return { count: times.length, finished: finished.length, mean: finished.length ? mean(finished) : null, lines };
}

export interface CaseStat {
  caseId: string;
  count: number;
  /** Mean and best of the finished solves; null when every solve of the case was a DNF. */
  mean: number | null;
  best: number | null;
}

/** Per-case results of a training session, slowest case first. */
export function byCase(solves: readonly Solve[]): CaseStat[] {
  const groups = new Map<string, number[]>();
  for (const solve of solves) {
    if (!solve.caseId) continue;
    groups.set(solve.caseId, [...(groups.get(solve.caseId) ?? []), resultOf(solve)]);
  }
  const stats = [...groups].map(([caseId, times]): CaseStat => {
    const finished = times.filter((time) => time !== DNF);
    return { caseId, count: times.length, mean: finished.length ? mean(finished) : null, best: least(finished) };
  });
  return stats.sort((a, b) => (b.mean ?? DNF) - (a.mean ?? DNF));
}

/** "12.34", "1:02.34" or "DNF". Times are cut to hundredths, as on a competition display. */
export function formatTime(ms: number | null): string {
  if (ms === null) return '–';
  if (ms === DNF) return 'DNF';
  const hundredths = Math.floor(ms / 10 + 1e-6);
  const seconds = Math.floor(hundredths / 100);
  const rest = `${String(seconds % 60).padStart(seconds >= 60 ? 2 : 1, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${rest}` : rest;
}

/** A solve as shown in the list: "14.34+" for a +2, "DNF(12.34)" for a DNF. */
export function formatSolve(solve: Solve): string {
  if (solve.penalty === 'dnf') return solve.ms ? `DNF(${formatTime(solve.ms)})` : 'DNF';
  return formatTime(resultOf(solve)) + (solve.penalty === '+2' ? '+' : '');
}
