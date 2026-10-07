// First two layers: shortest way to insert one corner-edge pair into the front-right slot without
// breaking the cross or the pairs already in. Other slots are handled by turning the cube first.

import { D, F, B, FACE_NORMALS, faceletAt, type Vec3 } from '../cube/geometry';
import type { CubeState } from '../cube/state';
import { CROSS_HOME } from './cross';
import { CORNER_ID, CORNER_TURN, EDGE_ID, EDGE_TURN, TURNS, distances, faceOfTurn, locate, oppositeFace } from './tracker';

/** The four slots going round from front-right: where each pair's corner and edge belong. */
const SLOT_AT: Vec3[] = [
  [1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [-1, 0, 1],
];

/** Reference stickers of each slot's pair: the corner's bottom sticker, the edge's front or back one. */
export const SLOTS = SLOT_AT.map(([x, , z]) => ({
  corner: faceletAt([x, -1, z], FACE_NORMALS[D]),
  edge: faceletAt([x, 0, z], FACE_NORMALS[z > 0 ? F : B]),
}));

export const slotSolved = (state: CubeState, slot: number) =>
  locate(state, SLOTS[slot].corner) === SLOTS[slot].corner && locate(state, SLOTS[slot].edge) === SLOTS[slot].edge;

/** Pairs are inserted without turning the bottom face, as a solver would. */
const PAIR_TURNS = TURNS.map((_, turn) => turn).filter((turn) => TURNS[turn].base !== 'D');
const MAX_DEPTH = 16;

// Exact number of turns to insert the front-right pair while also restoring the two cross edges
// next to it. Ignoring everything else makes it a lower bound, which is what the search needs.
let pairTable: Uint8Array | null = null;
const pairDistances = () =>
  (pairTable ??= distances(
    [CORNER_ID[SLOTS[0].corner], EDGE_ID[SLOTS[0].edge], EDGE_ID[CROSS_HOME[0]], EDGE_ID[CROSS_HOME[1]]],
    ['corner', 'edge', 'edge', 'edge'],
    PAIR_TURNS,
  ));

// Turns for a single sticker to get home, per home id: a cheap bound for the pieces to keep.
const alone = { edge: new Map<number, Uint8Array>(), corner: new Map<number, Uint8Array>() };
function distanceAlone(kind: 'edge' | 'corner', home: number): Uint8Array {
  let table = alone[kind].get(home);
  if (!table) alone[kind].set(home, (table = distances([home], [kind], PAIR_TURNS)));
  return table;
}

/**
 * Shortest insertions of the front-right pair, as lists of turn numbers; up to `limit` of them.
 * `state` needs its centres home and its cross solved. `kept` lists the other slots (1 to 3) whose
 * pairs are already in and must end up in again.
 */
export function insertFrontRight(state: CubeState, kept: readonly number[], limit = 24): number[][] {
  const dist = pairDistances();
  // Layout of a position: pair corner, pair edge, four cross edges, then kept corners, kept edges.
  const corners = [SLOTS[0].corner, ...kept.map((slot) => SLOTS[slot].corner)];
  const edges = [SLOTS[0].edge, ...CROSS_HOME, ...kept.map((slot) => SLOTS[slot].edge)];
  const cornerIds = corners.map((home) => CORNER_ID[locate(state, home)]);
  const edgeIds = edges.map((home) => EDGE_ID[locate(state, home)]);
  // Everything except the pair and its two cross edges is bounded one sticker at a time.
  const cornerBounds = corners.slice(1).map((home) => distanceAlone('corner', CORNER_ID[home]));
  const edgeBounds = edges.slice(3).map((home) => distanceAlone('edge', EDGE_ID[home]));

  const cornerCount = cornerIds.length;
  const edgeCount = edgeIds.length;
  const stackC = Array.from({ length: MAX_DEPTH + 1 }, () => new Uint8Array(cornerCount));
  const stackE = Array.from({ length: MAX_DEPTH + 1 }, () => new Uint8Array(edgeCount));
  stackC[0].set(cornerIds);
  stackE[0].set(edgeIds);

  const found: number[][] = [];
  const path: number[] = [];
  let bound = 0;

  const search = (depth: number, lastFace: number) => {
    const c = stackC[depth];
    const e = stackE[depth];
    const left = bound - depth;
    if (dist[((c[0] * 24 + e[0]) * 24 + e[1]) * 24 + e[2]] > left) return;
    for (let i = 1; i < cornerCount; i++) if (cornerBounds[i - 1][c[i]] > left) return;
    for (let i = 3; i < edgeCount; i++) if (edgeBounds[i - 3][e[i]] > left) return;
    if (left === 0) {
      found.push([...path]);
      return;
    }
    const nextC = stackC[depth + 1];
    const nextE = stackE[depth + 1];
    for (const turn of PAIR_TURNS) {
      const face = faceOfTurn(turn);
      if (face === lastFace || (face === oppositeFace(lastFace) && face < lastFace)) continue;
      const cornerTurn = CORNER_TURN[turn];
      const edgeTurn = EDGE_TURN[turn];
      for (let i = 0; i < cornerCount; i++) nextC[i] = cornerTurn[c[i]];
      for (let i = 0; i < edgeCount; i++) nextE[i] = edgeTurn[e[i]];
      path.push(turn);
      search(depth + 1, face);
      path.pop();
      if (found.length >= limit) return;
    }
  };

  for (bound = dist[((cornerIds[0] * 24 + edgeIds[0]) * 24 + edgeIds[1]) * 24 + edgeIds[2]]; bound <= MAX_DEPTH; bound++) {
    search(0, -1);
    if (found.length) return found;
  }
  throw new Error('No insertion found: the cube state is not solvable');
}
