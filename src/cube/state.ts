import { B, D, F, FACELETS, FACE_NORMALS, L, R, U, UNKNOWN, faceletAt, type Vec3 } from './geometry';
import { applyMoves, type Move } from './moves';

/** Colour of each of the 54 facelets, indexed like FACELETS. */
export type CubeState = readonly number[];

export const SOLVED: CubeState = FACELETS.map((f) => f.face);

export const centerOf = (face: number) => face * 9 + 4;

export const sameState = (a: CubeState, b: CubeState) => a.every((colour, i) => colour === b[i]);

/** The 24 whole-cube orientations, as rotation sequences. */
export const ROTATIONS: readonly Move[][] = (() => {
  const centers = (seq: Move[]) => {
    const state = applyMoves(SOLVED, seq);
    return FACE_NORMALS.map((_, face) => state[centerOf(face)]).join('');
  };
  const found = new Map<string, Move[]>([[centers([]), []]]);
  const queue: Move[][] = [[]];
  while (queue.length) {
    const seq = queue.shift()!;
    for (const base of ['x', 'y', 'z']) {
      const next: Move[] = [...seq, { base, amount: 1 }];
      const key = centers(next);
      if (found.has(key)) continue;
      found.set(key, next);
      queue.push(next);
    }
  }
  return [...found.values()];
})();

/**
 * Renames colours so that every centre shows its home colour, without moving anything. Use it after
 * an algorithm that leaves the cube rotated, to read the result from where the solver now stands.
 */
export function recolorToHome(state: CubeState): CubeState {
  const rename: number[] = [];
  FACE_NORMALS.forEach((_, face) => (rename[state[centerOf(face)]] = face));
  rename[UNKNOWN] = UNKNOWN;
  return state.map((colour) => rename[colour]);
}

// ----- Last layer -------------------------------------------------------------------------------

/** Side stickers of the last layer: front left-to-right, then right, back and left, going around. */
export const LL_SIDES: readonly number[] = [F, R, B, L].flatMap((face) => [0, 1, 2].map((col) => face * 9 + col));

export interface LLPiece {
  pos: Vec3;
  corner: boolean;
  /** Top facelet first. A corner's side facelets follow clockwise, seen from outside the cube. */
  facelets: readonly number[];
}

export const LL_PIECES: readonly LLPiece[] = (() => {
  const pieces: LLPiece[] = [];
  for (const z of [-1, 0, 1]) {
    for (const x of [-1, 0, 1]) {
      if (x === 0 && z === 0) continue;
      const pos: Vec3 = [x, 1, z];
      const top = faceletAt(pos, FACE_NORMALS[U]);
      const xSide = x === 0 ? [] : [faceletAt(pos, [x, 0, 0])];
      const zSide = z === 0 ? [] : [faceletAt(pos, [0, 0, z])];
      const sides = x * z > 0 ? [...xSide, ...zSide] : [...zSide, ...xSide];
      pieces.push({ pos, corner: x !== 0 && z !== 0, facelets: [top, ...sides] });
    }
  }
  return pieces;
})();

/** Index into LL_PIECES of the piece carrying a last-layer facelet. */
export const LL_PIECE_OF = new Map(LL_PIECES.flatMap((piece, p) => piece.facelets.map((i) => [i, p] as const)));

export const isTopOriented = (state: CubeState) => LL_PIECES.every((piece) => state[piece.facelets[0]] === U);

/** For each last-layer piece, which of its facelets shows the top colour (-1 if none does). */
export const ollOrientations = (state: CubeState) =>
  LL_PIECES.map((piece) => piece.facelets.findIndex((i) => state[i] === U));

/** A cube with the first two layers solved and only the top colour drawn on the last layer. */
export function ollState(orientations: readonly number[]): CubeState {
  const state = SOLVED.slice();
  LL_PIECES.forEach((piece, p) => piece.facelets.forEach((i, k) => (state[i] = k === orientations[p] ? U : UNKNOWN)));
  return state;
}

/** A cube with the last layer oriented and the given side stickers (null for unknown). */
export function pllState(sides: readonly (number | null)[]): CubeState {
  const state = SOLVED.slice();
  LL_SIDES.forEach((i, k) => (state[i] = sides[k] ?? UNKNOWN));
  return state;
}

export interface PieceArrow {
  from: Vec3;
  to: Vec3;
  /** The two pieces swap, so the arrow points both ways. */
  both: boolean;
}

/** Where each misplaced last-layer piece has to go. Empty unless every side sticker is known. */
export function pllArrows(state: CubeState): PieceArrow[] {
  const key = (v: Vec3) => v.join();
  const trips: [Vec3, Vec3][] = [];
  for (const piece of LL_PIECES) {
    let x = 0;
    let z = 0;
    for (const i of piece.facelets.slice(1)) {
      const colour = state[i];
      if (colour === UNKNOWN || colour === U || colour === D) return [];
      x += FACE_NORMALS[colour][0];
      z += FACE_NORMALS[colour][2];
    }
    if (x !== piece.pos[0] || z !== piece.pos[2]) trips.push([piece.pos, [x, 1, z]]);
  }
  const arrows: PieceArrow[] = [];
  for (const [from, to] of trips) {
    const both = trips.some(([a, b]) => key(a) === key(to) && key(b) === key(from));
    if (!both || key(from) < key(to)) arrows.push({ from, to, both });
  }
  return arrows;
}
