import { U_TURNS, applyMoves, invertMoves, parseAlg, type Move } from '../cube/moves';
import {
  ROTATIONS,
  SOLVED,
  centerOf,
  ollOrientations,
  ollState,
  pllArrows,
  recolorToHome,
  type CubeState,
} from '../cube/state';
import { OLL_CASES, OLL_GROUPS } from './oll';
import { PLL_CASES, PLL_GROUPS } from './pll';
import type { CaseDef } from './types';

export type AlgSet = 'oll' | 'pll';

export interface Alg {
  text: string;
  moves: Move[];
  /** The whole algorithm as one table: result[j] = state[pull[j]], re-oriented so centres stay home. */
  pull: number[];
}

export interface CaseEntry extends Omit<CaseDef, 'algs'> {
  set: AlgSet;
  algs: Alg[];
  /** The case as its first algorithm solves it, with no setup turn. */
  state: CubeState;
  /** What the input shows for this case: for OLL only the top colour is drawn on the last layer. */
  view: CubeState;
}

const IDENTITY = SOLVED.map((_, i) => i);
const CENTERS = [0, 1, 2, 3, 4, 5].map(centerOf);

export function compileAlg(text: string): Alg {
  const moves = parseAlg(text);
  const moved = applyMoves(IDENTITY, moves);
  for (const rotation of ROTATIONS) {
    const pull = applyMoves(moved, rotation);
    if (CENTERS.every((i) => pull[i] === i)) return { text, moves, pull };
  }
  throw new Error(`Cannot re-orient "${text}"`);
}

export const applyAlg = (state: CubeState, alg: Alg): CubeState => alg.pull.map((i) => state[i]);

/** The position an algorithm solves when applied as written. */
export const caseStateFor = (moves: readonly Move[]): CubeState =>
  recolorToHome(applyMoves(SOLVED, invertMoves(moves)));

const displaced = (state: CubeState) => pllArrows(state).reduce((n, arrow) => n + (arrow.both ? 2 : 1), 0);

// Some PLL algorithms finish a quarter turn off. Draw the case with the layer aligned, i.e. with as
// few pieces out of place as possible, rather than with that leftover turn baked in.
function alignedPllState(moves: readonly Move[]): CubeState {
  const states = U_TURNS.map((finish) => caseStateFor([...moves, ...finish]));
  return states.reduce((best, state) => (displaced(state) < displaced(best) ? state : best));
}

function build(set: AlgSet, defs: CaseDef[]): CaseEntry[] {
  return defs.map(({ algs: texts, ...def }) => {
    const algs = texts.map(compileAlg);
    if (set === 'pll') {
      const state = alignedPllState(algs[0].moves);
      return { ...def, set, algs, state, view: state };
    }
    const state = caseStateFor(algs[0].moves);
    return { ...def, set, algs, state, view: ollState(ollOrientations(state)) };
  });
}

export const CASES: Record<AlgSet, CaseEntry[]> = {
  oll: build('oll', OLL_CASES),
  pll: build('pll', PLL_CASES),
};

export const GROUPS: Record<AlgSet, string[]> = { oll: OLL_GROUPS, pll: PLL_GROUPS };

export const caseTitle = (entry: CaseEntry) => (entry.nickname ? `${entry.id} · ${entry.nickname}` : entry.id);
