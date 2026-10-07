// Cube geometry. Axes: x points right, y points up, z points toward the solver.
// Everything else (move tables, the 3D view, the 2D diagram) is derived from the facelet list below.

export type Vec3 = readonly [number, number, number];
export type Axis = 0 | 1 | 2;
/** +1 is a counter-clockwise quarter turn seen from the positive end of the axis (right-hand rule). */
export type Dir = 1 | -1;

// Face indices double as colour indices: a facelet's colour is the face it sits on when solved.
export const U = 0;
export const R = 1;
export const F = 2;
export const D = 3;
export const L = 4;
export const B = 5;
/** Colour of a sticker that is not known yet, or that does not matter for the current step. */
export const UNKNOWN = 6;

export const FACE_NORMALS: readonly Vec3[] = [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
  [-1, 0, 0],
  [0, 0, -1],
];

export interface Facelet {
  index: number;
  face: number;
  /** Position of the cubie carrying this sticker, each coordinate in -1..1. */
  pos: Vec3;
  normal: Vec3;
}

// Rows and columns read the way each face is seen from outside, with U viewed from above (front at
// the bottom) and D from below (front at the top).
function cubieAt(face: number, row: number, col: number): Vec3 {
  switch (face) {
    case U:
      return [col - 1, 1, row - 1];
    case R:
      return [1, 1 - row, 1 - col];
    case F:
      return [col - 1, 1 - row, 1];
    case D:
      return [col - 1, -1, 1 - row];
    case L:
      return [-1, 1 - row, col - 1];
    default:
      return [1 - col, 1 - row, -1];
  }
}

export const FACELETS: readonly Facelet[] = FACE_NORMALS.flatMap((normal, face) =>
  Array.from({ length: 9 }, (_, k) => ({
    index: face * 9 + k,
    face,
    pos: cubieAt(face, Math.floor(k / 3), k % 3),
    normal,
  })),
);

const keyOf = (pos: Vec3, normal: Vec3) => `${pos.join()}|${normal.join()}`;
const BY_KEY = new Map(FACELETS.map((f) => [keyOf(f.pos, f.normal), f.index]));

export function faceletAt(pos: Vec3, normal: Vec3): number {
  const index = BY_KEY.get(keyOf(pos, normal));
  if (index === undefined) throw new Error(`No facelet at ${keyOf(pos, normal)}`);
  return index;
}

/** Rotates an integer vector by a quarter turn about a coordinate axis. */
export function rotateVec([x, y, z]: Vec3, axis: Axis, dir: Dir): Vec3 {
  // "+ 0" turns -0 into 0 so that vectors stringify consistently.
  if (axis === 0) return dir === 1 ? [x, -z + 0, y] : [x, z, -y + 0];
  if (axis === 1) return dir === 1 ? [z, y, -x + 0] : [-z + 0, y, x];
  return dir === 1 ? [-y + 0, x, z] : [y, -x + 0, z];
}
