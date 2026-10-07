import { describe, expect, it } from 'vitest';
import { applyMoves, formatMove } from '../cube/moves';
import { SOLVED, recolorToHome } from '../cube/state';
import { makeScramble, type Random } from '../timer/scramble';
import { crossLength, crossOf, crossSolutions } from './cross';
import { slotSolved } from './f2l';
import { PACES, paceOf, secondsFor, subOf, typicalSeconds } from './pace';
import { movesOf, solveEach } from './solve';
import { TURNS } from './tracker';

function seeded(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('cross', () => {
  it('never needs more than eight turns, and every listed solution is a shortest one that works', () => {
    const random = seeded(11);
    let longest = 0;
    for (let i = 0; i < 300; i++) {
      const state = recolorToHome(makeScramble('333', null, random).state);
      const cross = crossOf(state);
      const length = crossLength(cross);
      longest = Math.max(longest, length);
      const solutions = crossSolutions(cross);
      expect(solutions.length).toBeGreaterThan(0);
      for (const turns of solutions) {
        expect(turns).toHaveLength(length);
        expect(crossLength(crossOf(applyMoves(state, turns.map((turn) => TURNS[turn]))))).toBe(0);
      }
    }
    expect(longest).toBeLessThanOrEqual(8);
    expect(longest).toBeGreaterThanOrEqual(6);
    expect(crossSolutions(crossOf(SOLVED))).toEqual([[]]);
  });
});

describe('full CFOP solutions', () => {
  it('solve the cube from every cross colour, stage by stage', () => {
    const random = seeded(12);
    const started = performance.now();
    const samples = 25;
    let turns = 0;
    let slowest = 0;
    let solved = 0;
    for (let i = 0; i < samples; i++) {
      const scramble = makeScramble('333', null, random);
      const before = performance.now();
      const solutions = [...solveEach(scramble.state)];
      slowest = Math.max(slowest, performance.now() - before);
      expect(new Set(solutions.map((s) => s.cross)).size).toBe(6);
      for (const solution of solutions) {
        const label = `${scramble.text} / cross ${solution.cross}: ${movesOf(solution).map(formatMove).join(' ')}`;
        expect(recolorToHome(applyMoves(scramble.state, movesOf(solution))), label).toEqual(SOLVED);

        // Each stage must finish what it claims to, and leave earlier stages intact.
        let state = scramble.state;
        let pairs = 0;
        for (const stage of solution.stages) {
          state = applyMoves(state, stage.moves);
          const seen = recolorToHome(state);
          if (stage.kind !== 'hold') expect(crossLength(crossOf(seen)), label).toBe(0);
          if (stage.kind === 'f2l') {
            pairs++;
            expect([0, 1, 2, 3].filter((slot) => slotSolved(seen, slot)).length, label).toBeGreaterThanOrEqual(pairs);
          }
        }
        expect(solution.stages[0].kind).toBe('hold');
        expect(solution.stages[1].kind).toBe('cross');
        expect(solution.stages[1].metrics.turns).toBeLessThanOrEqual(8);
        turns += solution.turns;
        solved++;
      }
      // Shortest cross first.
      const crossTurns = solutions.map((s) => s.stages[1].metrics.turns);
      expect(crossTurns).toEqual([...crossTurns].sort((a, b) => a - b));
    }
    const elapsed = performance.now() - started;
    console.log(
      `CFOP: ${solved} solutions over ${samples} scrambles, ${(turns / solved).toFixed(1)} turns on average, ` +
        `${(elapsed / samples).toFixed(0)} ms per scramble (all six colours), slowest ${slowest.toFixed(0)} ms`,
    );
  }, 120_000);

  it('can be told never to turn the whole cube during the solve', () => {
    const random = seeded(13);
    const totals = { free: { turns: 0, cost: 0, rotations: 0 }, fixed: { turns: 0, cost: 0, rotations: 0 } };
    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const scramble = makeScramble('333', null, random);
      for (const [mode, rotations] of [['free', true], ['fixed', false]] as const) {
        for (const solution of solveEach(scramble.state, { rotations })) {
          expect(recolorToHome(applyMoves(scramble.state, movesOf(solution))), scramble.text).toEqual(SOLVED);
          if (!rotations) {
            // Only the first stage, which puts the cube in position, may turn it.
            const turning = solution.stages.slice(1).flatMap((stage) => stage.moves).filter((move) => 'xyz'.includes(move.base));
            expect(turning.map(formatMove), scramble.text).toEqual([]);
            expect(solution.rotations).toBe(0);
          }
          totals[mode].turns += solution.turns;
          totals[mode].cost += solution.cost;
          totals[mode].rotations += solution.rotations;
        }
      }
    }
    const per = (value: number) => (value / (samples * 6)).toFixed(1);
    console.log(
      `CFOP with rotations: ${per(totals.free.turns)} turns, ${per(totals.free.rotations)} rotations, effort ${per(totals.free.cost)} | ` +
        `without: ${per(totals.fixed.turns)} turns, effort ${per(totals.fixed.cost)}`,
    );
    expect(totals.free.rotations).toBeGreaterThan(0);
  }, 120_000);
});

describe('time estimate', () => {
  it('turns effort and pace into a time and its sub', () => {
    expect(secondsFor(60, 3)).toBe(20);
    expect(subOf(19.6)).toBe(20);
    expect(subOf(20)).toBe(21);
    // Someone averaging 35 seconds turns at 2 beats a second, and the reverse.
    expect(paceOf(35000)).toBeCloseTo(2);
    expect(typicalSeconds(2)).toBe(35);
    expect(PACES).toEqual([...PACES].sort((a, b) => a - b));
  });
});
