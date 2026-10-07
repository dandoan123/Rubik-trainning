// A whole CFOP solution for a scrambled cube, for each of the six colours the cross can be built on.
//
// The cross is the shortest possible one. Each pair of the first two layers is then inserted by its
// shortest insertion, easiest pair first, turning the cube beforehand when that makes the insertion
// more comfortable. The last layer is solved with the app's own OLL and PLL algorithms.

import { D, F } from '../cube/geometry';
import { U_TURNS, applyMoves, simplify, turnedAround, type Move } from '../cube/moves';
import {
  ROTATIONS,
  centerOf,
  isTopOriented,
  ollOrientations,
  ollState,
  recolorToHome,
  type CubeState,
} from '../cube/state';
import { analyseFingerTricks, type FingerMetrics } from '../solver/fingertrick';
import { aufToSolve, findSolutions } from '../solver/solve';
import { crossOf, crossSolutions } from './cross';
import { insertFrontRight, slotSolved } from './f2l';
import { TURNS } from './tracker';

export type StageKind = 'hold' | 'cross' | 'f2l' | 'oll' | 'pll';

export interface Stage {
  kind: StageKind;
  moves: Move[];
  metrics: FingerMetrics;
  /** For OLL and PLL: the case that came up. */
  caseId?: string;
}

export interface CfopSolution {
  /** Colour of the cross (the face held down) and of the face held in front. */
  cross: number;
  front: number;
  /** In order. The first stage only turns the whole cube into position and costs nothing. */
  stages: Stage[];
  /** Turns and estimated effort of everything after picking the cube up. */
  turns: number;
  rotations: number;
  cost: number;
}

/** Whole-cube turns about the vertical axis, by number of quarter turns. */
const Y: readonly Move[][] = [[], [{ base: 'y', amount: 1 }], [{ base: 'y', amount: 2 }], [{ base: 'y', amount: 3 }]];

/** The cube after some moves, described from where the solver now looks at it (centres home). */
const after = (state: CubeState, moves: readonly Move[]) => recolorToHome(applyMoves(state, moves));

const stage = (kind: StageKind, moves: Move[], caseId?: string): Stage => ({ kind, moves, metrics: analyseFingerTricks(moves), caseId });

const easier = (a: FingerMetrics, b: FingerMetrics) => a.cost < b.cost || (a.cost === b.cost && a.turns < b.turns);

interface Start {
  cross: number;
  front: number;
  hold: Move[];
  /** The cube once held that way, centres home. */
  state: CubeState;
  solution: Stage;
}

/** For each cross colour, the most comfortable way to hold the cube and its best shortest cross. */
function crossStarts(scrambled: CubeState): Start[] {
  const best = new Map<number, Start>();
  for (const rotation of ROTATIONS) {
    const held = applyMoves(scrambled, rotation);
    const state = recolorToHome(held);
    const cross = held[centerOf(D)];
    for (const turns of crossSolutions(crossOf(state))) {
      const solution = stage('cross', turns.map((turn) => TURNS[turn]));
      const current = best.get(cross);
      if (current && !easier(solution.metrics, current.solution.metrics)) continue;
      best.set(cross, { cross, front: held[centerOf(F)], hold: simplify(rotation), state, solution });
    }
  }
  return [...best.values()].sort((a, b) => a.solution.metrics.turns - b.solution.metrics.turns || a.solution.metrics.cost - b.solution.metrics.cost);
}

/** The easiest pair to insert next, or null when all four are in. */
function nextPair(state: CubeState): Stage | null {
  let best: Stage | null = null;
  for (let slot = 0; slot < 4; slot++) {
    if (slotSolved(state, slot)) continue;
    // Look at the cube from the side that puts this slot at the front right, solve it there, ...
    const seen = after(state, Y[slot]);
    const kept = [1, 2, 3].filter((other) => slotSolved(seen, other));
    for (const turns of insertFrontRight(seen, kept)) {
      const insertion = turns.map((turn) => TURNS[turn]);
      // ... then pick how far to really turn the cube: all the way, part of the way, or not at all.
      for (let turned = 0; turned < 4; turned++) {
        const candidate = stage('f2l', [...Y[turned], ...turnedAround(insertion, (slot - turned + 4) % 4)]);
        if (!best || easier(candidate.metrics, best.metrics)) best = candidate;
      }
    }
  }
  return best;
}

function lastLayer(state: CubeState): Stage[] {
  const stages: Stage[] = [];
  if (!isTopOriented(state)) {
    const [best] = findSolutions(ollState(ollOrientations(state)), 'oll');
    stages.push(stage('oll', [...U_TURNS[best.pre], ...best.alg.moves], best.entry.id));
    state = after(state, stages[0].moves);
  }
  const align = aufToSolve(state);
  if (align === null) {
    const [best] = findSolutions(state, 'pll');
    stages.push(stage('pll', [...U_TURNS[best.pre], ...best.alg.moves, ...U_TURNS[best.post]], best.entry.id));
  } else if (align) {
    stages.push(stage('pll', [...U_TURNS[align]]));
  }
  return stages;
}

function finish(start: Start): CfopSolution {
  const stages: Stage[] = [{ kind: 'hold', moves: start.hold, metrics: { cost: 0, turns: 0, regrips: 0, rotations: 0 } }, start.solution];
  let state = after(start.state, start.solution.moves);
  for (let pair = nextPair(state); pair; pair = nextPair(state)) {
    stages.push(pair);
    state = after(state, pair.moves);
  }
  stages.push(...lastLayer(state));
  const sum = (pick: (metrics: FingerMetrics) => number) => stages.reduce((total, { metrics }) => total + pick(metrics), 0);
  return {
    cross: start.cross,
    front: start.front,
    stages,
    turns: sum((m) => m.turns),
    rotations: sum((m) => m.rotations),
    cost: sum((m) => m.cost),
  };
}

/**
 * Solutions for all six cross colours, one at a time, shortest cross first. `scrambled` may be held
 * any way round; the first stage of each solution says how to turn it.
 */
export function* solveEach(scrambled: CubeState): Generator<CfopSolution> {
  for (const start of crossStarts(scrambled)) yield finish(start);
}

/** Every move of a solution in order, including the turns that put the cube in position. */
export const movesOf = (solution: CfopSolution): Move[] => solution.stages.flatMap((s) => s.moves);
