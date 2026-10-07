import { describe, expect, it } from 'vitest';
import { B, F, L, R, U } from './geometry';
import { MOVE_DEFS, applyMoves, formatMove, invertMoves, parseAlg } from './moves';
import { ROTATIONS, SOLVED } from './state';

const run = (alg: string, state = SOLVED) => applyMoves(state, parseAlg(alg));
const face = (state: readonly number[], f: number) => state.slice(f * 9, f * 9 + 9);

describe('moves', () => {
  it('turns faces clockwise as seen from outside', () => {
    // R carries the front face's right column up onto U.
    const afterR = face(run('R'), U);
    expect([afterR[2], afterR[5], afterR[8]]).toEqual([F, F, F]);
    // U carries the right face's top row round to the front.
    expect(face(run('U'), F).slice(0, 3)).toEqual([R, R, R]);
    expect(face(run('U'), R).slice(0, 3)).toEqual([B, B, B]);
    // F carries the left face's column onto the bottom row of U, and U's onto R.
    expect(face(run('F'), U).slice(6)).toEqual([L, L, L]);
    const rightAfterF = face(run('F'), R);
    expect([rightAfterF[0], rightAfterF[3], rightAfterF[6]]).toEqual([U, U, U]);
  });

  it('returns to solved after four quarter turns of anything', () => {
    for (const base of Object.keys(MOVE_DEFS)) expect(run(`${base} ${base} ${base} ${base}`)).toEqual(SOLVED);
  });

  it('builds wide turns and rotations from face and slice turns', () => {
    const same: [string, string][] = [
      ['r', "R M'"],
      ['l', 'L M'],
      ['u', "U E'"],
      ['d', 'D E'],
      ['f', 'F S'],
      ['b', "B S'"],
      ['x', "r L'"],
      ['y', "u D'"],
      ['z', "f B'"],
      ['Rw2', 'r r'],
    ];
    for (const [a, b] of same) expect(run(a), a).toEqual(run(b));
  });

  it('agrees with well-known identities', () => {
    expect(run("R U R' U' ".repeat(6))).toEqual(SOLVED);
    expect(run("R U R' U R U2 R' R U2 R' U' R U' R'")).toEqual(SOLVED);
    expect(run("M2 U M2 U2 M2 U M2 ".repeat(2))).toEqual(SOLVED);
    expect(run("R U R' U' R' F R2 U' R' U' R U R' F' ".repeat(2))).toEqual(SOLVED);
    expect(run("R U R' U' ")).not.toEqual(SOLVED);
  });

  it('parses and inverts notation', () => {
    const alg = parseAlg("(R U2' Rw') x2 M’ d");
    expect(alg.map(formatMove).join(' ')).toBe("R U2 r' x2 M' d");
    expect(applyMoves(applyMoves(SOLVED, alg), invertMoves(alg))).toEqual(SOLVED);
    expect(() => parseAlg('R Q')).toThrow();
    expect(() => parseAlg('Mw')).toThrow();
  });

  it('knows all 24 orientations', () => {
    expect(ROTATIONS).toHaveLength(24);
  });
});
