// Fast bookkeeping for searches: instead of moving all 54 stickers, follow one sticker per piece.
// Where a piece's reference sticker sits tells both where the piece is and how it is turned.

import { FACELETS, type Vec3 } from '../cube/geometry';
import { applyMove, type Move } from '../cube/moves';
import type { CubeState } from '../cube/state';

const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'];

/** The 18 outer-face turns. Turn t moves face floor(t / 3) by (t % 3) + 1 quarter turns. */
export const TURNS: readonly Move[] = FACE_LETTERS.flatMap((base) =>
  ([1, 2, 3] as const).map((amount) => ({ base, amount })),
);
export const faceOfTurn = (turn: number) => Math.floor(turn / 3);
/** Faces are listed so that opposite ones are three apart. */
export const oppositeFace = (face: number) => (face + 3) % 6;

const zeros = (pos: Vec3) => pos.filter((value) => value === 0).length;
const EDGE_FACELETS = FACELETS.filter((f) => zeros(f.pos) === 1).map((f) => f.index);
const CORNER_FACELETS = FACELETS.filter((f) => zeros(f.pos) === 0).map((f) => f.index);

function numbering(facelets: number[]): Int8Array {
  const ids = new Int8Array(54).fill(-1);
  facelets.forEach((facelet, id) => (ids[facelet] = id));
  return ids;
}

/** A sticker's place among the 24 edge (or 24 corner) facelets, or -1 for other facelets. */
export const EDGE_ID = numbering(EDGE_FACELETS);
export const CORNER_ID = numbering(CORNER_FACELETS);

// EDGE_TURN[t][id]: where turn t sends the edge sticker with that id; likewise for corners.
function turnTable(ids: Int8Array): Uint8Array[] {
  const identity = FACELETS.map((f) => f.index);
  return TURNS.map((move) => {
    const sourceOf = applyMove(identity, move);
    const table = new Uint8Array(24);
    sourceOf.forEach((from, to) => {
      if (ids[from] >= 0) table[ids[from]] = ids[to];
    });
    return table;
  });
}

export const EDGE_TURN = turnTable(EDGE_ID);
export const CORNER_TURN = turnTable(CORNER_ID);

const CUBIES = new Map<string, number[]>();
for (const f of FACELETS) CUBIES.set(f.pos.join(), [...(CUBIES.get(f.pos.join()) ?? []), f.index]);

/**
 * Where the sticker that belongs on facelet `home` currently is. The state must have its centres
 * home, since a piece is recognised by its colours.
 */
export function locate(state: CubeState, home: number): number {
  const mates = CUBIES.get(FACELETS[home].pos.join())!;
  const colours = mates.map((i) => FACELETS[i].face).sort().join();
  for (const facelets of CUBIES.values()) {
    if (facelets.length !== mates.length) continue;
    if (facelets.map((i) => state[i]).sort().join() !== colours) continue;
    return facelets.find((i) => state[i] === FACELETS[home].face)!;
  }
  throw new Error(`No piece for facelet ${home}: not a valid cube state`);
}

/**
 * Fewest turns needed to bring a group of tracked stickers home, for every arrangement of them.
 * `kinds[i]` says whether sticker i is an edge or a corner sticker; `home[i]` is its id when solved.
 * The arrangement is packed as a base-24 number, first sticker most significant.
 */
export function distances(home: readonly number[], kinds: readonly ('edge' | 'corner')[], turns: readonly number[]): Uint8Array {
  const tables = kinds.map((kind) => (kind === 'edge' ? EDGE_TURN : CORNER_TURN));
  const count = home.length;
  const dist = new Uint8Array(24 ** count).fill(255);
  const ids = new Uint8Array(count);
  const start = home.reduce((code, id) => code * 24 + id, 0);
  dist[start] = 0;
  let frontier = [start];
  for (let depth = 1; frontier.length; depth++) {
    const next: number[] = [];
    for (const code of frontier) {
      for (let i = count - 1, rest = code; i >= 0; i--, rest = Math.floor(rest / 24)) ids[i] = rest % 24;
      for (const turn of turns) {
        let moved = 0;
        for (let i = 0; i < count; i++) moved = moved * 24 + tables[i][turn][ids[i]];
        if (dist[moved] !== 255) continue;
        dist[moved] = depth;
        next.push(moved);
      }
    }
    frontier = next;
  }
  return dist;
}
