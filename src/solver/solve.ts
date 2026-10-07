import { U_TURNS, applyMoves } from '../cube/moves';
import { SOLVED, isTopOriented, sameState, type CubeState } from '../cube/state';
import { CASES, applyAlg, type Alg, type AlgSet, type CaseEntry } from '../data/cases';
import { DEFAULT_PREFS, analyseFingerTricks, type FingerMetrics, type Prefs } from './fingertrick';

const AUF_BY_EFFORT = [0, 1, 3, 2];
const aufEffort = (turns: number) => (turns === 0 ? 0 : turns === 2 ? 2 : 1);

export interface Solution {
  entry: CaseEntry;
  alg: Alg;
  /** Position of the algorithm in its case's list; 0 is the best-known one. */
  algIndex: number;
  /** Top-layer quarter turns to make before the algorithm, and (PLL only) after it. */
  pre: number;
  post: number;
  metrics: FingerMetrics;
}

/** Number of U turns that finish a permuted-but-misaligned last layer, or null if it is not solved. */
export function aufToSolve(state: CubeState): number | null {
  const turns = AUF_BY_EFFORT.find((k) => sameState(applyMoves(state, U_TURNS[k]), SOLVED));
  return turns ?? null;
}

function fit(state: CubeState, set: AlgSet, alg: Alg): { pre: number; post: number } | null {
  let best: { pre: number; post: number } | null = null;
  for (const pre of AUF_BY_EFFORT) {
    const after = applyAlg(applyMoves(state, U_TURNS[pre]), alg);
    if (set === 'oll') {
      if (isTopOriented(after)) return { pre, post: 0 };
      continue;
    }
    const post = aufToSolve(after);
    if (post === null) continue;
    if (!best || aufEffort(pre) + aufEffort(post) < aufEffort(best.pre) + aufEffort(best.post)) best = { pre, post };
  }
  return best;
}

/**
 * Every known algorithm that solves the given last-layer position, easiest to execute first.
 * For OLL only the top-colour stickers of the last layer matter; for PLL the state must be complete.
 */
export function findSolutions(state: CubeState, set: AlgSet, prefs: Prefs = DEFAULT_PREFS): Solution[] {
  const solutions: Solution[] = [];
  for (const entry of CASES[set]) {
    entry.algs.forEach((alg, algIndex) => {
      const setup = fit(state, set, alg);
      if (setup) solutions.push({ entry, alg, algIndex, ...setup, metrics: analyseFingerTricks(alg.moves, prefs) });
    });
  }
  return solutions.sort((a, b) => a.metrics.cost - b.metrics.cost || a.algIndex - b.algIndex);
}
