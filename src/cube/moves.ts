import { FACELETS, faceletAt, rotateVec, type Axis, type Dir } from './geometry';

export interface MoveDef {
  axis: Axis;
  /** Coordinates along the axis of the layers that turn. */
  slices: readonly number[];
  /** Direction of the plain (unprimed) quarter turn. */
  dir: Dir;
}

export interface Move {
  /** Key of MOVE_DEFS. Lower-case face letters are wide turns. */
  base: string;
  /** Number of plain quarter turns: 3 is the primed move. */
  amount: 1 | 2 | 3;
}

const def = (axis: Axis, slices: number[], dir: Dir): MoveDef => ({ axis, slices, dir });

// Slices follow the usual convention: M turns like L, E like D, S like F.
export const MOVE_DEFS: Readonly<Record<string, MoveDef>> = {
  R: def(0, [1], -1),
  L: def(0, [-1], 1),
  M: def(0, [0], 1),
  r: def(0, [0, 1], -1),
  l: def(0, [-1, 0], 1),
  x: def(0, [-1, 0, 1], -1),
  U: def(1, [1], -1),
  D: def(1, [-1], 1),
  E: def(1, [0], 1),
  u: def(1, [0, 1], -1),
  d: def(1, [-1, 0], 1),
  y: def(1, [-1, 0, 1], -1),
  F: def(2, [1], -1),
  B: def(2, [-1], 1),
  S: def(2, [0], -1),
  f: def(2, [0, 1], -1),
  b: def(2, [-1, 0], 1),
  z: def(2, [-1, 0, 1], -1),
};

// table[amount][j] is the facelet whose sticker ends up at j.
function buildTable({ axis, slices, dir }: MoveDef): number[][] {
  const quarter = FACELETS.map((f) => f.index);
  for (const f of FACELETS) {
    if (!slices.includes(f.pos[axis])) continue;
    quarter[faceletAt(rotateVec(f.pos, axis, dir), rotateVec(f.normal, axis, dir))] = f.index;
  }
  const half = quarter.map((i) => quarter[i]);
  const threeQuarter = half.map((i) => quarter[i]);
  return [[], quarter, half, threeQuarter];
}

const TABLES = new Map(Object.entries(MOVE_DEFS).map(([base, d]) => [base, buildTable(d)]));

export function applyMove<T>(state: readonly T[], move: Move): T[] {
  return TABLES.get(move.base)![move.amount].map((i) => state[i]);
}

export function applyMoves<T>(state: readonly T[], moves: readonly Move[]): T[] {
  let current = state.slice();
  for (const move of moves) current = applyMove(current, move);
  return current;
}

export const invertMove = (move: Move): Move => ({ base: move.base, amount: (4 - move.amount) as Move['amount'] });

export const invertMoves = (moves: readonly Move[]): Move[] => moves.map(invertMove).reverse();

/** U_TURNS[k] is k clockwise quarter turns of the top layer, written as at most one move. */
export const U_TURNS: readonly Move[][] = [
  [],
  [{ base: 'U', amount: 1 }],
  [{ base: 'U', amount: 2 }],
  [{ base: 'U', amount: 3 }],
];

/** Merges consecutive turns of the same face (or rotations about the same axis) and drops those that cancel. */
export function simplify(moves: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const move of moves) {
    const last = out.at(-1);
    if (last?.base !== move.base) {
      out.push(move);
      continue;
    }
    out.pop();
    const amount = (last.amount + move.amount) % 4;
    if (amount) out.push({ base: move.base, amount: amount as Move['amount'] });
  }
  return out;
}

const SIDES = ['F', 'R', 'B', 'L'];
/**
 * Face turns as they read after the whole cube has been turned `quarters` times like U: what was
 * a turn of the front face is now a turn of the right face, and so on round.
 */
export const turnedAround = (moves: readonly Move[], quarters: number): Move[] =>
  moves.map((move) => {
    const side = SIDES.indexOf(move.base);
    return side < 0 ? move : { ...move, base: SIDES[(side + quarters) % 4] };
  });

export const formatMove = ({ base, amount }: Move): string => base + (amount === 2 ? '2' : amount === 3 ? "'" : '');

const TOKEN = /([RLUDFBMESxyzrludfb])(w?)(2'|2|')?/y;

/** Parses WCA-style notation. Brackets and whitespace only group moves and are ignored. */
export function parseAlg(text: string): Move[] {
  const clean = text.replace(/[’‘`´]/g, "'").replace(/[()[\]\s]/g, '');
  const moves: Move[] = [];
  let at = 0;
  while (at < clean.length) {
    TOKEN.lastIndex = at;
    const match = TOKEN.exec(clean);
    if (!match || (match[2] && !'RLUDFB'.includes(match[1]))) {
      throw new Error(`Cannot read "${clean.slice(at)}" in algorithm "${text}"`);
    }
    const base = match[2] ? match[1].toLowerCase() : match[1];
    moves.push({ base, amount: match[3] === "'" ? 3 : match[3] ? 2 : 1 });
    at = TOKEN.lastIndex;
  }
  return moves;
}
