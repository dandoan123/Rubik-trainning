// Scramble generation: a random-move scramble for full solves, and case scrambles for last-layer
// practice built from the algorithm database.

import { FACE_NORMALS, rotateVec, type Vec3 } from '../cube/geometry';
import { MOVE_DEFS, U_TURNS, applyMoves, formatMove, invertMoves, simplify, turnedAround, type Move } from '../cube/moves';
import { SOLVED, type CubeState } from '../cube/state';
import { CASES, type AlgSet, type CaseEntry } from '../data/cases';

export type ScrambleType = '333' | AlgSet;

export interface Scramble {
  type: ScrambleType;
  moves: Move[];
  text: string;
  /** The cube after the scramble, held the way the scramble is meant to be applied. */
  state: CubeState;
  /** The case this scramble sets up, for training scrambles. */
  caseId: string | null;
}

export type Random = () => number;

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)];
const amountOf = (turns: number) => (((turns % 4) + 4) % 4) as 0 | Move['amount'];

/** Random face turns: never the same face twice running, nor three turns in a row on one axis. */
export function randomMoves(length: number, random: Random): Move[] {
  const moves: Move[] = [];
  const axis = (move: Move | undefined) => (move ? MOVE_DEFS[move.base].axis : -1);
  while (moves.length < length) {
    const base = pick(FACES, random);
    const last = moves.at(-1);
    const sameAxisRun = axis(last) === axis(moves.at(-2)) && axis(last) === MOVE_DEFS[base].axis;
    if (base === last?.base || sameAxisRun) continue;
    moves.push({ base, amount: pick([1, 2, 3] as const, random) });
  }
  return moves;
}

// A wide or slice turn is some outer-face turns plus a whole-cube rotation: r = L x, M = R L' x', ...
const AS_FACE_TURNS: Record<string, [base: string, turns: number][]> = {
  r: [['L', 1], ['x', 1]],
  l: [['R', 1], ['x', -1]],
  u: [['D', 1], ['y', 1]],
  d: [['U', 1], ['y', -1]],
  f: [['B', 1], ['z', 1]],
  b: [['F', 1], ['z', -1]],
  M: [['R', 1], ['L', -1], ['x', -1]],
  E: [['U', 1], ['D', -1], ['y', -1]],
  S: [['F', -1], ['B', 1], ['z', 1]],
};

const faceOf = (normal: Vec3) => FACE_NORMALS.findIndex((n) => n.every((value, i) => value === normal[i]));

/**
 * Rewrites an algorithm with outer-face turns only, the way scrambles are written. Rotations are
 * absorbed by renaming the faces that follow, so the result leaves the same cube, just not rotated.
 */
export function toFaceTurns(moves: readonly Move[]): Move[] {
  // seat[f] is the face of the unrotated cube currently sitting where the solver sees face f.
  let seat = FACES.map((_, face) => face);
  const out: Move[] = [];
  const turn = (base: string, turns: number) => {
    const amount = amountOf(turns);
    if (!amount) return;
    if (!'xyz'.includes(base)) {
      out.push({ base: FACES[seat[FACES.indexOf(base)]], amount });
      return;
    }
    const { axis, dir } = MOVE_DEFS[base];
    const back = (-dir) as 1 | -1;
    for (let quarter = 0; quarter < amount; quarter++) {
      const before = seat;
      seat = FACES.map((_, face) => before[faceOf(rotateVec(FACE_NORMALS[face], axis, back))]);
    }
  };
  for (const move of moves) {
    for (const [base, turns] of AS_FACE_TURNS[move.base] ?? [[move.base, 1]]) turn(base, turns * move.amount);
  }
  return out;
}

const anyTurn = (random: Random) => U_TURNS[Math.floor(random() * 4)];

/**
 * A scramble that leaves the first two layers solved and the given case on top. An OLL scramble
 * also shuffles the last layer's pieces, so solving the OLL does not always end in the same PLL.
 */
export function caseMoves(entry: CaseEntry, random: Random): Move[] {
  const setup = [...anyTurn(random), ...invertMoves(pick(entry.algs, random).moves), ...anyTurn(random)];
  const shuffle = entry.set === 'oll' ? [...pick(pick(CASES.pll, random).algs, random).moves, ...anyTurn(random)] : [];
  return turnedAround(simplify(toFaceTurns([...shuffle, ...setup])), Math.floor(random() * 4));
}

// Full scrambles are applied with white on top and green in front; this app's cube model has
// yellow on top, so start from the cube turned over.
const WHITE_ON_TOP: CubeState = applyMoves(SOLVED, [{ base: 'z', amount: 2 }]);
const FULL_LENGTH = 25;

/** `allowed` limits training scrambles to those case ids; null allows every case. */
export function makeScramble(type: ScrambleType, allowed: readonly string[] | null, random: Random = Math.random): Scramble {
  if (type === '333') {
    const moves = randomMoves(FULL_LENGTH, random);
    return { type, moves, text: moves.map(formatMove).join(' '), state: applyMoves(WHITE_ON_TOP, moves), caseId: null };
  }
  const pool = CASES[type].filter((entry) => !allowed || allowed.includes(entry.id));
  const entry = pick(pool.length ? pool : CASES[type], random);
  const moves = caseMoves(entry, random);
  return { type, moves, text: moves.map(formatMove).join(' '), state: applyMoves(SOLVED, moves), caseId: entry.id };
}
