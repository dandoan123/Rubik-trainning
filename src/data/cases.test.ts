import { describe, expect, it } from 'vitest';
import { FACELETS } from '../cube/geometry';
import { LL_PIECES, isTopOriented, ollOrientations, ollState, pllArrows, type CubeState } from '../cube/state';
import { findSolutions } from '../solver/solve';
import { CASES, caseStateFor, type AlgSet, type CaseEntry } from './cases';

const F2L = FACELETS.filter((f) => f.pos[1] < 1);
const f2lSolved = (state: CubeState) => F2L.every((f) => state[f.index] === f.face);
const inputFor = (set: AlgSet, state: CubeState) => (set === 'oll' ? ollState(ollOrientations(state)) : state);
const number = (entry: CaseEntry) => Number(entry.short);

describe.each(['oll', 'pll'] as const)('%s algorithms', (set) => {
  it('has every case exactly once', () => {
    expect(CASES[set]).toHaveLength(set === 'oll' ? 57 : 21);
    expect(new Set(CASES[set].map((entry) => entry.id)).size).toBe(CASES[set].length);
  });

  it('only touch the last layer', () => {
    const problems: string[] = [];
    for (const entry of CASES[set]) {
      for (const alg of entry.algs) {
        const state = caseStateFor(alg.moves);
        if (!f2lSolved(state)) problems.push(`${entry.id}: "${alg.text}" disturbs the first two layers`);
        else if (set === 'pll' && !isTopOriented(state)) problems.push(`${entry.id}: "${alg.text}" twists pieces`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('solve their own case and no other', () => {
    const problems: string[] = [];
    for (const entry of CASES[set]) {
      const solutions = findSolutions(entry.view, set);
      const strangers = new Set(solutions.filter((s) => s.entry !== entry).map((s) => s.entry.id));
      if (strangers.size) problems.push(`${entry.id} is the same case as ${[...strangers].join(', ')}`);
      for (const alg of entry.algs) {
        if (solutions.some((s) => s.alg === alg)) continue;
        const actual = findSolutions(inputFor(set, caseStateFor(alg.moves)), set).map((s) => s.entry.id);
        problems.push(`${entry.id}: "${alg.text}" solves ${[...new Set(actual)].join(', ') || 'no known case'} instead`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('need no setup turn on the canonical position', () => {
    for (const entry of CASES[set]) {
      const first = findSolutions(entry.view, set).find((s) => s.algIndex === 0)!;
      expect([entry.id, first.pre]).toEqual([entry.id, 0]);
    }
  });
});

describe('OLL case shapes', () => {
  const edges = LL_PIECES.map((piece, p) => ({ piece, p })).filter(({ piece }) => !piece.corner);
  const corners = LL_PIECES.map((piece, p) => ({ piece, p })).filter(({ piece }) => piece.corner);
  const orientedEdges = (entry: CaseEntry) => {
    const orientations = ollOrientations(entry.state);
    return edges.filter(({ p }) => orientations[p] === 0).map(({ piece }) => piece.pos);
  };
  const orientedCorners = (entry: CaseEntry) => {
    const orientations = ollOrientations(entry.state);
    return corners.filter(({ p }) => orientations[p] === 0).length;
  };

  it('have the edge pattern their group promises', () => {
    const line = new Set([13, 14, 15, 16, 33, 34, 39, 40, 45, 46, 51, 52, 55, 56, 57]);
    const problems: string[] = [];
    for (const entry of CASES.oll) {
      const oriented = orientedEdges(entry);
      const expected = entry.group.startsWith('Dot') ? 0 : entry.group.startsWith('Cross') ? 4 : 2;
      if (oriented.length !== expected) {
        problems.push(`${entry.id}: ${oriented.length} oriented edges, expected ${expected}`);
      } else if (expected === 2) {
        const opposite = oriented[0][0] === -oriented[1][0] && oriented[0][2] === -oriented[1][2];
        if (opposite !== line.has(number(entry))) problems.push(`${entry.id}: wrong edge shape`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('have the corner count of the well-known cases', () => {
    const expected: Record<number, number> = { 20: 4, 21: 0, 22: 0, 23: 2, 24: 2, 25: 2, 26: 1, 27: 1, 28: 4, 57: 4 };
    const actual = Object.fromEntries(
      CASES.oll.filter((entry) => number(entry) in expected).map((entry) => [number(entry), orientedCorners(entry)]),
    );
    expect(actual).toEqual(expected);
  });

  it('cover every position that can occur on a real cube', () => {
    const problems: string[] = [];
    const total = LL_PIECES.reduce((n, piece) => n * piece.facelets.length, 1);
    let reachable = 0;
    for (let code = 0; code < total; code++) {
      let rest = code;
      const orientations = LL_PIECES.map((piece) => {
        const o = rest % piece.facelets.length;
        rest = Math.floor(rest / piece.facelets.length);
        return o;
      });
      const twist = corners.reduce((sum, { p }) => sum + orientations[p], 0) % 3;
      const flips = edges.reduce((sum, { p }) => sum + orientations[p], 0) % 2;
      const legal = twist === 0 && flips === 0;
      const solvable = orientations.every((o) => o === 0) || findSolutions(ollState(orientations), 'oll').length > 0;
      if (legal) reachable++;
      if (legal !== solvable) problems.push(`${orientations.join('')}: legal=${legal}, solvable=${solvable}`);
    }
    expect(reachable).toBe(216);
    expect(problems).toEqual([]);
  });
});

describe('PLL case shapes', () => {
  it('move only the pieces their group promises', () => {
    const problems: string[] = [];
    for (const entry of CASES.pll) {
      const moved = pllArrows(entry.state).flatMap((arrow) => [arrow.from, arrow.to]);
      const movesCorners = moved.some((pos) => pos[0] !== 0 && pos[2] !== 0);
      const movesEdges = moved.some((pos) => pos[0] === 0 || pos[2] === 0);
      const expectCorners = !entry.group.startsWith('Chỉ hoán vị cạnh');
      const expectEdges = !entry.group.startsWith('Chỉ hoán vị góc');
      if (movesCorners !== expectCorners || movesEdges !== expectEdges) problems.push(entry.id);
    }
    expect(problems).toEqual([]);
  });
});
