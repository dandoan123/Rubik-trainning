import { describe, expect, it } from 'vitest';
import { D, F, FACELETS } from '../cube/geometry';
import { MOVE_DEFS, applyMoves, parseAlg, simplify, type Move } from '../cube/moves';
import { ROTATIONS, SOLVED, centerOf, isTopOriented, ollOrientations, ollState, type CubeState } from '../cube/state';
import { CASES } from '../data/cases';
import { findSolutions } from '../solver/solve';
import { makeScramble, randomMoves, toFaceTurns, type Random } from './scramble';
import { DNF, average, byCase, formatSolve, formatTime, mean, rolling, summarize, trimOf, type Solve } from './stats';

/** Small seeded generator, so that the randomised tests always see the same scrambles. */
function seeded(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CENTERS = [0, 1, 2, 3, 4, 5].map(centerOf);
/** The same cube turned so that its centres are home. */
const settled = (state: CubeState) =>
  ROTATIONS.map((rotation) => applyMoves(state, rotation)).find((turned) => CENTERS.every((i, face) => turned[i] === face))!;
const f2lSolved = (state: CubeState) => FACELETS.filter((f) => f.pos[1] < 1).every((f) => state[f.index] === f.face);
const onlyFaceTurns = (moves: Move[]) => moves.every((move) => 'URFDLB'.includes(move.base));
const seconds = (...values: number[]) => values.map((value) => value * 1000);
const solve = (ms: number, penalty: Solve['penalty'] = 'ok', caseId?: string): Solve => ({ id: `${ms}`, ms, penalty, scramble: '', at: 0, caseId });

describe('scrambles', () => {
  it('avoids turns that cancel or merge', () => {
    const moves = randomMoves(2000, seeded(1));
    expect(moves).toHaveLength(2000);
    expect(onlyFaceTurns(moves)).toBe(true);
    const axes = moves.map((move) => MOVE_DEFS[move.base].axis);
    moves.forEach((move, i) => {
      if (i > 0) expect(move.base).not.toBe(moves[i - 1].base);
      if (i > 1) expect(axes[i] === axes[i - 1] && axes[i] === axes[i - 2]).toBe(false);
    });
    expect(new Set(moves.map((move) => move.base)).size).toBe(6);
  });

  it('rewrites rotations, wide and slice turns as face turns without changing the cube', () => {
    const samples = [
      ...Object.keys(MOVE_DEFS).flatMap((base) => [base, `${base}2`, `${base}'`]).map((text) => `R U F ${text} L D' B2`),
      "x R' U R' D2 y R U' r' M2 U S E' z' f b' l u2 d R",
      ...[...CASES.oll, ...CASES.pll].flatMap((entry) => entry.algs.map((alg) => alg.text)),
    ];
    for (const text of samples) {
      const original = parseAlg(text);
      const rewritten = toFaceTurns(original);
      expect(onlyFaceTurns(rewritten), text).toBe(true);
      expect(applyMoves(SOLVED, rewritten), text).toEqual(settled(applyMoves(SOLVED, original)));
    }
  });

  it('merges repeated faces', () => {
    const text = (alg: string) => simplify(parseAlg(alg)).map((move) => move.base + move.amount).join(' ');
    expect(text("R R U U2 F F' D")).toBe('R2 U3 D1');
    expect(text("R U U' R' F")).toBe('F1');
  });

  it.each(['pll', 'oll'] as const)('sets up exactly the %s case it names', (set) => {
    const random = seeded(set === 'pll' ? 2 : 3);
    const seen = new Set<string>();
    const positions = new Map<string, Set<string>>();
    for (let i = 0; i < 600; i++) {
      const scramble = makeScramble(set, null, random);
      expect(onlyFaceTurns(scramble.moves)).toBe(true);
      expect(f2lSolved(scramble.state), scramble.text).toBe(true);
      const input = set === 'pll' ? scramble.state : ollState(ollOrientations(scramble.state));
      if (set === 'pll') expect(isTopOriented(scramble.state), scramble.text).toBe(true);
      const found = new Set(findSolutions(input, set).map((s) => s.entry.id));
      expect([...found], scramble.text).toEqual([scramble.caseId]);
      seen.add(scramble.caseId!);
      positions.set(scramble.caseId!, (positions.get(scramble.caseId!) ?? new Set()).add(scramble.state.join('')));
    }
    expect(seen.size).toBe(CASES[set].length);
    // An OLL case must come with varying permutations, or solving it would always end the same way.
    if (set === 'oll') expect(Math.min(...[...positions.values()].map((states) => states.size))).toBeGreaterThan(1);
  });

  it('keeps to the chosen cases', () => {
    const random = seeded(4);
    const allowed = ['PLL T', 'PLL Ua'];
    const drawn = new Set(Array.from({ length: 60 }, () => makeScramble('pll', allowed, random).caseId));
    expect(drawn).toEqual(new Set(allowed));
    expect(makeScramble('pll', [], random).caseId).not.toBeNull();
  });

  it('gives full scrambles for a cube held white on top, green in front', () => {
    const scramble = makeScramble('333', null, seeded(5));
    expect(scramble.moves).toHaveLength(25);
    expect(scramble.caseId).toBeNull();
    expect(scramble.state[centerOf(0)]).toBe(D);
    expect(scramble.state[centerOf(F)]).toBe(F);
    expect(scramble.text.split(' ')).toHaveLength(25);
  });
});

describe('statistics', () => {
  it('formats times cut to hundredths', () => {
    expect(formatTime(12349)).toBe('12.34');
    expect(formatTime(990)).toBe('0.99');
    expect(formatTime(62340)).toBe('1:02.34');
    expect(formatTime(600000)).toBe('10:00.00');
    expect(formatTime(DNF)).toBe('DNF');
    expect(formatTime(null)).toBe('–');
    expect(formatSolve(solve(12340, '+2'))).toBe('14.34+');
    expect(formatSolve(solve(12340, 'dnf'))).toBe('DNF(12.34)');
  });

  it('leaves out the best and worst results of an average', () => {
    expect(average(seconds(10, 11, 12, 13, 14))).toBe(12000);
    expect(average(seconds(9, 20, 11, 12, 13))).toBe(12000);
    expect(average([...seconds(10, 11, 12, 13), DNF])).toBe(12000);
    expect(average([...seconds(10, 11, 12), DNF, DNF])).toBe(DNF);
    expect([5, 12, 50, 100].map(trimOf)).toEqual([1, 1, 3, 5]);
  });

  it('counts a DNF fully in a mean', () => {
    expect(mean(seconds(10, 11, 12))).toBe(11000);
    expect(mean([...seconds(10, 11), DNF])).toBe(DNF);
  });

  it('rolls averages along the session', () => {
    const times = seconds(10, 11, 12, 13, 14, 9);
    expect(rolling(times, 5, 'average')).toEqual([null, null, null, null, 12000, 12000]);
    expect(rolling(times, 3, 'mean')).toEqual([null, null, 11000, 12000, 13000, 12000]);
  });

  it('summarises a session', () => {
    const summary = summarize([solve(10000), solve(11000), solve(12000), solve(13000, 'dnf'), solve(14000), solve(7000, '+2')]);
    expect(summary).toMatchObject({ count: 6, finished: 5, mean: 11200 });
    const line = (label: string) => summary.lines.find((l) => l.label === label);
    expect(line('single')).toEqual({ label: 'single', current: 9000, best: 9000 });
    expect(line('mo3')).toMatchObject({ current: DNF, best: 11000 });
    // Both windows drop their best time and the DNF, leaving 11, 12 and 14 seconds.
    expect(line('ao5')!.current).toBeCloseTo(37000 / 3);
    expect(line('ao5')!.best).toBeCloseTo(37000 / 3);
    expect(line('ao12')).toMatchObject({ current: null, best: null });
    expect(summarize([]).lines[0]).toEqual({ label: 'single', current: null, best: null });
  });

  it('ranks practised cases from slowest to fastest', () => {
    const stats = byCase([solve(3000, 'ok', 'PLL T'), solve(5000, 'ok', 'PLL T'), solve(2000, 'ok', 'PLL H'), solve(1000, 'dnf', 'PLL Z'), solve(9000)]);
    expect(stats).toEqual([
      { caseId: 'PLL Z', count: 1, mean: null, best: null },
      { caseId: 'PLL T', count: 2, mean: 4000, best: 3000 },
      { caseId: 'PLL H', count: 1, mean: 2000, best: 2000 },
    ]);
  });
});
