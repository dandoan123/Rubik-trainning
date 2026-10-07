import { describe, expect, it } from 'vitest';
import { F, L, R } from '../cube/geometry';
import { parseAlg } from '../cube/moves';
import { LL_PIECES, LL_SIDES, ollOrientations } from '../cube/state';
import { CASES } from '../data/cases';
import { analyseFingerTricks } from './fingertrick';
import { EMPTY_OLL, EMPTY_PLL, PLL_POSITIONS, allowedColours, clickOll, nextOpen, readOll, readPll } from './input';
import { findSolutions } from './solve';

const cost = (alg: string, avoidSlices = false) => analyseFingerTricks(parseAlg(alg), { avoidSlices });

describe('finger-trick cost', () => {
  it('prices plain flicks at one each', () => {
    expect(cost("R U R' U'")).toMatchObject({ cost: 4, turns: 4, regrips: 0, rotations: 0 });
  });

  it('charges a regrip when a wrist runs out of travel', () => {
    expect(cost('R U R U R').regrips).toBe(1);
    expect(cost("R U R' U R U2 R'").regrips).toBe(0);
  });

  it('prefers right-hand, rotation-free algorithms', () => {
    expect(cost("R U R' U R U2 R'").cost).toBeLessThan(cost("L' U' L U' L' U2 L").cost);
    expect(cost("R U R' U R' F R F' R U2 R'").cost).toBeLessThan(cost("R U R' y R' F R U' R' F' R").cost);
    expect(cost("R U R' y R' F R U' R' F' R").rotations).toBe(1);
  });

  it('treats opposite faces turned together as little more than one move', () => {
    expect(cost("U D'").cost).toBeCloseTo(1 + 1.4 * 0.4);
    expect(cost("U R D'").cost).toBeCloseTo(1 + 1 + 1.4);
    expect(cost("R U R' U' B' R' F R F' B").cost).toBeGreaterThan(cost("R U R2 U' R' F R U R U' F'").cost);
  });

  it('can be told to avoid slice turns', () => {
    const slices = "M2 U M U2 M' U M2";
    const twoGen = "R U' R U R U R U' R' U' R2";
    expect(cost(slices).cost).toBeLessThan(cost(twoGen).cost);
    expect(cost(slices, true).cost).toBeGreaterThan(cost(twoGen, true).cost);
  });
});

describe('OLL input', () => {
  const corners = LL_PIECES.map((piece, p) => (piece.corner ? p : -1)).filter((p) => p >= 0);
  const edges = LL_PIECES.map((piece, p) => (piece.corner ? -1 : p)).filter((p) => p >= 0);

  it('assumes untouched pieces face up', () => {
    const reading = readOll(EMPTY_OLL);
    expect(reading.orientations.every((o) => o === 0)).toBe(true);
    expect(reading.cornersOk && reading.edgesOk).toBe(true);
  });

  it('deduces the last corner and the last edge', () => {
    const input = EMPTY_OLL.slice();
    input[corners[0]] = 1;
    input[corners[1]] = 0;
    expect(readOll(input).cornersOk).toBe(false);
    input[corners[2]] = 0;
    const reading = readOll(input);
    expect(reading.orientations[corners[3]]).toBe(2);
    expect(reading.deduced[corners[3]]).toBe(true);
    expect(reading.cornersOk).toBe(true);

    for (const p of edges.slice(0, 3)) input[p] = 1;
    expect(readOll(input).orientations[edges[3]]).toBe(1);
    expect(readOll(input).edgesOk).toBe(true);
  });

  it('reaches any case by clicking where the top colour is', () => {
    for (const entry of CASES.oll) {
      const target = ollOrientations(entry.state);
      let input = EMPTY_OLL;
      let clicks = 0;
      LL_PIECES.forEach((piece, p) => {
        if (readOll(input).orientations[p] === target[p]) return;
        input = clickOll(input, p, piece.facelets[target[p]]);
        clicks++;
      });
      const reading = readOll(input);
      expect(reading.orientations, entry.id).toEqual(target);
      expect(clicks, entry.id).toBeLessThanOrEqual(6);
      expect(findSolutions(reading.state, 'oll')[0].entry.id).toBe(entry.id);
    }
  });

  it('cycles a piece through its orientations from the top sticker', () => {
    const p = corners[0];
    const top = LL_PIECES[p].facelets[0];
    let input = EMPTY_OLL;
    const seen = [0, 1, 2].map(() => {
      input = clickOll(input, p, top);
      return input[p];
    });
    expect(seen).toEqual([1, 2, 0]);
  });
});

describe('PLL input', () => {
  it('knows all 288 positions', () => {
    expect(PLL_POSITIONS).toHaveLength(288);
    expect(new Set(PLL_POSITIONS.map((position) => position.caseId)).size).toBe(22);
  });

  it('deduces the other sticker of a corner', () => {
    const frontRight = LL_SIDES.indexOf(F * 9 + 2);
    const rightFront = LL_SIDES.indexOf(R * 9);
    const input = EMPTY_PLL.slice();
    input[frontRight] = F;
    const reading = readPll(input);
    expect(reading.sides[rightFront]).toBe(R);
    expect(reading.deduced[rightFront]).toBe(true);
    expect(reading.deduced[frontRight]).toBe(false);
  });

  it('only offers colours that can still occur', () => {
    const input = EMPTY_PLL.slice();
    expect(allowedColours(input, 0)).toEqual(new Set([F, R, 5, L]));
    input[0] = F;
    // The left sticker of that corner is now forced, so nothing else is offered for it.
    const leftFront = LL_SIDES.indexOf(L * 9 + 2);
    expect(allowedColours(input, leftFront).size).toBe(1);
    // Entering it anyway must not empty the candidates of the sticker that forced it.
    expect(allowedColours(input, 0)).toEqual(new Set([F, R, 5, L]));
  });

  it('identifies every position within five entries, without looking at the back', () => {
    let worst = 0;
    let total = 0;
    for (const position of PLL_POSITIONS) {
      let input = EMPTY_PLL;
      let entries = 0;
      for (let reading = readPll(input); !reading.position; reading = readPll(input)) {
        const at = nextOpen(reading)!;
        expect(at).toBeLessThan(6);
        input = input.map((colour, i) => (i === at ? position.sides[at] : colour));
        entries++;
      }
      expect(readPll(input).position).toBe(position);
      worst = Math.max(worst, entries);
      total += entries;
    }
    expect(worst).toBeLessThanOrEqual(5);
    console.log(`PLL entries needed: worst ${worst}, average ${(total / PLL_POSITIONS.length).toFixed(2)}`);
  });

  it('solves every complete position', () => {
    for (const position of PLL_POSITIONS) {
      if (position.caseId === null) continue;
      const solutions = findSolutions(readPll(position.sides).state, 'pll');
      expect(new Set(solutions.map((s) => s.entry.id))).toEqual(new Set([position.caseId]));
    }
  });
});
