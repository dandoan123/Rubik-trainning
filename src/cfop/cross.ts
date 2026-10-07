// Optimal cross: every shortest way to put the four bottom edges in place.

import { D, FACE_NORMALS, faceletAt, type Vec3 } from '../cube/geometry';
import type { CubeState } from '../cube/state';
import { EDGE_ID, EDGE_TURN, TURNS, distances, faceOfTurn, locate, oppositeFace } from './tracker';

const BELOW: Vec3[] = [
  [0, -1, 1],
  [1, -1, 0],
  [0, -1, -1],
  [-1, -1, 0],
];

/** Bottom stickers of the cross edges: front, right, back, left. */
export const CROSS_HOME: readonly number[] = BELOW.map((pos) => faceletAt(pos, FACE_NORMALS[D]));

const ALL_TURNS = TURNS.map((_, turn) => turn);
let table: Uint8Array | null = null;
/** Turns still needed for each arrangement of the four cross stickers. Built on first use. */
const crossDistances = () =>
  (table ??= distances(CROSS_HOME.map((facelet) => EDGE_ID[facelet]), ['edge', 'edge', 'edge', 'edge'], ALL_TURNS));

const pack = (a: number, b: number, c: number, d: number) => ((a * 24 + b) * 24 + c) * 24 + d;

/** Ids of the four cross stickers in a cube whose centres are home and whose cross colour is down. */
export const crossOf = (state: CubeState) => CROSS_HOME.map((home) => EDGE_ID[locate(state, home)]);

export const crossLength = ([a, b, c, d]: readonly number[]) => crossDistances()[pack(a, b, c, d)];

/**
 * Shortest cross solutions, as lists of turn numbers. Sequences that only differ in the order of
 * two opposite faces are listed once. Stops after `limit` solutions.
 */
export function crossSolutions(cross: readonly number[], limit = 48): number[][] {
  const dist = crossDistances();
  const found: number[][] = [];
  const path: number[] = [];
  const walk = (a: number, b: number, c: number, d: number, lastFace: number) => {
    const left = dist[pack(a, b, c, d)];
    if (left === 0) {
      found.push([...path]);
      return;
    }
    for (const turn of ALL_TURNS) {
      const face = faceOfTurn(turn);
      if (face === lastFace || (face === oppositeFace(lastFace) && face < lastFace)) continue;
      const [na, nb, nc, nd] = [EDGE_TURN[turn][a], EDGE_TURN[turn][b], EDGE_TURN[turn][c], EDGE_TURN[turn][d]];
      if (dist[pack(na, nb, nc, nd)] !== left - 1) continue;
      path.push(turn);
      walk(na, nb, nc, nd, face);
      path.pop();
      if (found.length >= limit) return;
    }
  };
  walk(cross[0], cross[1], cross[2], cross[3], -1);
  return found;
}
