// What the timer remembers between visits, kept in the browser's local storage.

import type { AlgSet } from '../data/cases';
import type { ScrambleType } from './scramble';
import type { Solve } from './stats';

export interface TimerData {
  type: ScrambleType;
  /** Give 15 seconds to look at the cube before each solve. */
  inspection: boolean;
  /** Show the suggested solution next to the scramble. */
  showSolution: boolean;
  /** Suggest solutions that never turn the whole cube once the solve has started. */
  noRotations: boolean;
  /** Pace, in beats per second, to estimate solution times for; null uses the solver's own pace. */
  pace: number | null;
  /** Solves of each scramble type, oldest first. */
  sessions: Record<ScrambleType, Solve[]>;
  /** Cases to practise in each set; null means all of them. */
  chosen: Record<AlgSet, string[] | null>;
}

const KEY = 'll-trainer.timer.v1';

const fresh = (): TimerData => ({
  type: '333',
  inspection: false,
  showSolution: true,
  noRotations: false,
  pace: null,
  sessions: { '333': [], oll: [], pll: [] },
  chosen: { oll: null, pll: null },
});

const isSolve = (value: unknown): value is Solve => {
  const solve = value as Solve;
  return typeof solve?.id === 'string' && Number.isFinite(solve.ms) && ['ok', '+2', 'dnf'].includes(solve.penalty);
};

/** Reads the saved data, falling back to an empty timer for anything missing or damaged. */
export function loadTimerData(): TimerData {
  const data = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<TimerData>;
    if (saved.type && saved.type in data.sessions) data.type = saved.type;
    data.inspection = saved.inspection === true;
    data.showSolution = saved.showSolution !== false;
    data.noRotations = saved.noRotations === true;
    if (typeof saved.pace === 'number' && saved.pace > 0) data.pace = saved.pace;
    for (const type of Object.keys(data.sessions) as ScrambleType[]) {
      const list = saved.sessions?.[type];
      if (Array.isArray(list)) data.sessions[type] = list.filter(isSolve);
    }
    for (const set of Object.keys(data.chosen) as AlgSet[]) {
      const ids = saved.chosen?.[set];
      if (Array.isArray(ids)) data.chosen[set] = ids.filter((id) => typeof id === 'string');
    }
  } catch {
    // Storage is unavailable (private browsing) or holds something unreadable: start empty.
  }
  return data;
}

/** Returns false when the browser refused to store the data. */
export function saveTimerData(data: TimerData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The session as a spreadsheet-friendly file: one line per solve, oldest first. */
export function toCsv(solves: readonly Solve[]): string {
  const cell = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const rows = solves.map((solve, i) =>
    [i + 1, (solve.ms / 1000).toFixed(2), solve.penalty, cell(solve.scramble), new Date(solve.at).toISOString(), cell(solve.caseId ?? '')].join(','),
  );
  return ['no,seconds,penalty,scramble,finished_at,case', ...rows].join('\n');
}
