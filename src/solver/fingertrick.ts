// Heuristic execution cost of an algorithm for a right-handed solver.
//
// Each hand's wrist is tracked as -1 (tilted down), 0 (home) or 1 (tilted up): R raises the right
// wrist, L' raises the left one. A turn that would push a wrist past that range forces a regrip.
// Other moves are priced by how comfortably they can be flicked from the current grip, and the
// cheapest sequence of grips is found by dynamic programming. The numbers are relative effort,
// tuned so that a plain R or U flick costs 1.

import type { Move } from '../cube/moves';

export interface Prefs {
  /** Rank algorithms with M / S / E turns lower. */
  avoidSlices: boolean;
}

export const DEFAULT_PREFS: Prefs = { avoidSlices: false };

export interface FingerMetrics {
  cost: number;
  /** Turns excluding cube rotations. */
  turns: number;
  regrips: number;
  rotations: number;
}

type Grip = readonly [right: number, left: number];

const WRIST = [-1, 0, 1];
const GRIPS: Grip[] = WRIST.flatMap((right) => WRIST.map((left): Grip => [right, left]));
const gripIndex = ([right, left]: Grip) => (right + 1) * 3 + (left + 1);

const REGRIP = 1.2;
const OFF_HOME_START = 0.2;
const DOUBLE = 1.45;
const SLICE_PENALTY = 1.5;
/** These opposite faces can turn at the same time, one per hand, so the second turn is nearly free. */
const OPPOSITE: Readonly<Record<string, string>> = { U: 'D', D: 'U', R: 'L', L: 'R' };
const TOGETHER = 0.4;

/** New wrist position after a turn, or null if the wrist cannot reach it. */
function turnWrist(wrist: number, amount: Move['amount'], raise: 1 | -1): number | null {
  if (amount === 2) return wrist === 0 ? null : -wrist;
  const next = wrist + (amount === 1 ? raise : -raise);
  return Math.abs(next) > 1 ? null : next;
}

interface Outcome {
  cost: number;
  /** Grip afterwards; null when the hands re-seat freely (after a cube rotation). */
  grip: Grip | null;
}

function perform({ base, amount }: Move, grip: Grip, prefs: Prefs): Outcome | null {
  const [right, left] = grip;
  const double = amount === 2;
  const flat = (quarter: number, half = quarter * DOUBLE): Outcome => ({ cost: double ? half : quarter, grip });
  const slice = prefs.avoidSlices ? SLICE_PENALTY : 0;

  switch (base) {
    case 'R':
    case 'r': {
      const next = turnWrist(right, amount, 1);
      if (next === null) return null;
      return { cost: (base === 'R' ? 1 : 1.15) * (double ? DOUBLE : 1), grip: [next, left] };
    }
    case 'L':
    case 'l': {
      const next = turnWrist(left, amount, -1);
      if (next === null) return null;
      return { cost: (base === 'L' ? 1.2 : 1.35) * (double ? DOUBLE : 1), grip: [right, next] };
    }
    case 'U':
      // U is a right index flick and U' a left index flick; a wrist tilted down has to push instead.
      if (amount === 1) return flat(right >= 0 ? 1 : 1.3);
      if (amount === 3) return flat(left >= 0 ? 1 : right >= 0 ? 1.25 : 1.5);
      return flat(0, right >= 0 || left >= 0 ? 1.4 : 1.9);
    case 'F':
    case 'f': {
      // F is easiest right after R' (index finger already behind the face), F' from home grip.
      const byWrist = amount === 1 ? [1.15, 1.4, 1.9] : amount === 3 ? [1.5, 1.35, 1.6] : [1.9, 2.1, 2.4];
      return { cost: byWrist[right + 1] + (base === 'f' ? 0.3 : 0), grip };
    }
    case 'D':
      return flat(1.4, 1.9);
    case 'u':
    case 'd':
      return flat(1.6, 2.2);
    case 'B':
      return flat(2.6, 3.2);
    case 'b':
      return flat(2.9, 3.5);
    case 'M': {
      const quarter = amount === 3 ? 1.3 : 1.5;
      return { cost: (double ? 1.7 : quarter) + (right === 0 ? 0 : 0.6) + slice, grip };
    }
    case 'S':
      return flat(1.9 + slice, 2.5 + slice);
    case 'E':
      return flat(2.3 + slice, 2.9 + slice);
    case 'x':
      return { cost: double ? 1.7 : 1.3, grip: null };
    case 'z':
      return { cost: double ? 2.3 : 1.8, grip: null };
    default:
      return { cost: double ? 2.6 : 2, grip: null };
  }
}

export function analyseFingerTricks(moves: readonly Move[], prefs: Prefs = DEFAULT_PREFS): FingerMetrics {
  let cost: number[] = GRIPS.map(([right, left]) => (right === 0 && left === 0 ? 0 : OFF_HOME_START));
  let regrips = GRIPS.map(() => 0);

  for (const [at, move] of moves.entries()) {
    const previous = at > 0 ? moves[at - 1].base : null;
    const effort = OPPOSITE[move.base] === previous ? TOGETHER : 1;
    const nextCost = GRIPS.map(() => Infinity);
    const nextRegrips = GRIPS.map(() => 0);
    const best = cost.indexOf(Math.min(...cost));
    const relax = (grip: Grip | null, total: number, count: number) => {
      for (const g of grip ? [grip] : GRIPS) {
        const i = gripIndex(g);
        if (total >= nextCost[i]) continue;
        nextCost[i] = total;
        nextRegrips[i] = count;
      }
    };
    GRIPS.forEach((grip, i) => {
      const outcome = perform(move, grip, prefs);
      if (!outcome) return;
      relax(outcome.grip, cost[i] + outcome.cost * effort, regrips[i]);
      relax(outcome.grip, cost[best] + REGRIP + outcome.cost * effort, regrips[best] + 1);
    });
    cost = nextCost;
    regrips = nextRegrips;
  }

  const best = cost.indexOf(Math.min(...cost));
  const rotations = moves.filter((move) => 'xyz'.includes(move.base)).length;
  return { cost: cost[best], turns: moves.length - rotations, regrips: regrips[best], rotations };
}
