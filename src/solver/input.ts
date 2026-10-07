// Turns what the user has entered so far into a cube state, filling in everything that the rules of
// the cube already decide.

import { U_TURNS, applyMoves, invertMoves } from '../cube/moves';
import { LL_PIECES, LL_SIDES, SOLVED, ollState, pllState, recolorToHome, type CubeState } from '../cube/state';
import { CASES } from '../data/cases';

// ----- OLL: where is the top colour on each last-layer piece? -------------------------------------

/** Per piece of LL_PIECES: index of the facelet showing the top colour, or null if not entered. */
export type OllInput = readonly (number | null)[];

export const EMPTY_OLL: OllInput = LL_PIECES.map(() => null);

export interface OllReading {
  /** Entered, deduced or (failing both) assumed to face up. */
  orientations: number[];
  /** Pieces whose orientation was forced by the others rather than entered. */
  deduced: boolean[];
  state: CubeState;
  /** Corner twists must cancel out and an even number of edges must be flipped. */
  cornersOk: boolean;
  edgesOk: boolean;
}

export function readOll(input: OllInput): OllReading {
  const orientations = input.map((value) => value ?? 0);
  const deduced = input.map(() => false);
  const check = (corner: boolean, modulus: number) => {
    const pieces = LL_PIECES.map((_, p) => p).filter((p) => LL_PIECES[p].corner === corner);
    const open = pieces.filter((p) => input[p] === null);
    const total = () => pieces.reduce((sum, p) => sum + orientations[p], 0) % modulus;
    // With a single piece left, the others leave it exactly one legal orientation.
    if (open.length === 1 && total() !== 0) {
      orientations[open[0]] = modulus - total();
      deduced[open[0]] = true;
    }
    return total() === 0;
  };
  const cornersOk = check(true, 3);
  const edgesOk = check(false, 2);
  return { orientations, deduced, state: ollState(orientations), cornersOk, edgesOk };
}

/** The input after clicking a last-layer facelet of piece `p`. */
export function clickOll(input: OllInput, p: number, facelet: number): OllInput {
  const piece = LL_PIECES[p];
  const current = readOll(input).orientations[p];
  const clicked = piece.facelets.indexOf(facelet);
  // The top sticker cycles through the piece's orientations; a side sticker puts the colour there.
  const target = clicked === 0 ? (current + 1) % piece.facelets.length : clicked === current ? 0 : clicked;
  return input.map((value, i) => (i === p ? target : value));
}

// ----- PLL: colours of the twelve side stickers ---------------------------------------------------

/** Per sticker of LL_SIDES: its colour, or null if not entered. */
export type PllInput = readonly (number | null)[];

export const EMPTY_PLL: PllInput = LL_SIDES.map(() => null);

export interface PllPosition {
  sides: number[];
  /** Id of the PLL case, or null when the layer only needs a U turn (or nothing). */
  caseId: string | null;
}

/** All 288 positions a permuted last layer can be in, seen with the green centre in front. */
export const PLL_POSITIONS: readonly PllPosition[] = (() => {
  const found = new Map<string, PllPosition>();
  const add = (caseId: string | null, undo: ReturnType<typeof invertMoves>) => {
    for (const before of U_TURNS) {
      for (const after of U_TURNS) {
        const state = recolorToHome(applyMoves(SOLVED, [...before, ...undo, ...after]));
        const sides = LL_SIDES.map((i) => state[i]);
        found.set(sides.join(''), { sides, caseId });
      }
    }
  };
  add(null, []);
  for (const entry of CASES.pll) add(entry.id, invertMoves(entry.algs[0].moves));
  return [...found.values()];
})();

export interface PllReading {
  /** Positions still compatible with what was entered. */
  candidates: PllPosition[];
  /** Entered colours plus every colour all candidates agree on; null where still open. */
  sides: (number | null)[];
  deduced: boolean[];
  /** The position, once only one is left. */
  position: PllPosition | null;
  state: CubeState;
}

const candidatesFor = (input: PllInput) =>
  PLL_POSITIONS.filter((position) => input.every((colour, i) => colour === null || colour === position.sides[i]));

export function readPll(input: PllInput): PllReading {
  const candidates = candidatesFor(input);
  const sides = input.map((colour, i) => {
    if (colour !== null || candidates.length === 0) return colour;
    const first = candidates[0].sides[i];
    return candidates.every((position) => position.sides[i] === first) ? first : null;
  });
  return {
    candidates,
    sides,
    deduced: sides.map((colour, i) => colour !== null && input[i] === null),
    position: candidates.length === 1 ? candidates[0] : null,
    state: pllState(sides),
  };
}

/** The next sticker worth asking about: front first, then around the cube. Null once all are known. */
export function nextOpen(reading: PllReading): number | null {
  const at = reading.sides.indexOf(null);
  return at < 0 ? null : at;
}

/** Colours sticker `at` can still take, given the other entered stickers. */
export function allowedColours(input: PllInput, at: number): Set<number> {
  const others = input.map((colour, i) => (i === at ? null : colour));
  return new Set(candidatesFor(others).map((position) => position.sides[at]));
}
