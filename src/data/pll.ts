import type { CaseDef } from './types';

const EDGES = 'Chỉ hoán vị cạnh';
const CORNERS = 'Chỉ hoán vị góc';
const ADJACENT = 'Đổi 2 góc kề nhau';
const DIAGONAL = 'Đổi 2 góc chéo nhau';
const G_PERMS = 'Nhóm G — xoay vòng 3 góc và 3 cạnh';

export const PLL_GROUPS = [EDGES, CORNERS, ADJACENT, DIAGONAL, G_PERMS];

const pll = (name: string, group: string, algs: string[]): CaseDef => ({
  id: `PLL ${name}`,
  short: name,
  group,
  algs,
});

export const PLL_CASES: CaseDef[] = [
  pll('Ua', EDGES, ["M2 U M U2 M' U M2", "R U' R U R U R U' R' U' R2", "R2 U' R' U' R U R U R U' R"]),
  pll('Ub', EDGES, ["M2 U' M U2 M' U' M2", "R2 U R U R' U' R' U' R' U R'", "R' U R' U' R' U' R' U R U R2"]),
  pll('Z', EDGES, ["M' U M2 U M2 U M' U2 M2", "M2 U M2 U M' U2 M2 U2 M'", "M' U' M2 U' M2 U' M' U2 M2"]),
  pll('H', EDGES, ["M2 U M2 U2 M2 U M2", "M2 U' M2 U2 M2 U' M2"]),
  pll('Aa', CORNERS, ["x R' U R' D2 R U' R' D2 R2 x'", "l' U R' D2 R U' R' D2 R2 x'", "R' F R' B2 R F' R' B2 R2"]),
  pll('Ab', CORNERS, ["x R2 D2 R U R' D2 R U' R x'", "R2 B2 R F R' B2 R F' R"]),
  pll('E', CORNERS, ["x' R U' R' D R U R' D' R U R' D R U' R' D' x", "x' L' U L D' L' U' L D L' U' L D' L' U L D x"]),
  pll('T', ADJACENT, ["(R U R' U') R' F R2 U' R' U' (R U R' F')"]),
  pll('F', ADJACENT, ["R' U' F' (R U R' U') R' F R2 U' R' U' R U R' U R"]),
  pll('Ja', ADJACENT, ["x R2 F R F' R U2 r' U r U2 x'", "R' U L' U2 R U' R' U2 R L", "L' U' L F L' U' L U L F' L2 U L"]),
  pll('Jb', ADJACENT, ["R U R' F' (R U R' U') R' F R2 U' R'"]),
  pll('Ra', ADJACENT, ["R U' R' U' R U R D R' U' R D' R' U2 R'", "R U R' F' R U2 R' U2 R' F R U R U2 R'"]),
  pll('Rb', ADJACENT, ["R2 F R U R U' R' F' R U2 R' U2 R", "R' U2 R U2 R' F (R U R' U') R' F' R2"]),
  pll('V', DIAGONAL, ["R' U R' U' y R' F' R2 U' R' U R' F R F", "R U' R U R' D R D' R U' D R2 U R2 D' R2", "R' U R' d' R' F' R2 U' R' U R' F R F"]),
  pll('Y', DIAGONAL, ["F R U' R' U' R U R' F' (R U R' U') (R' F R F')"]),
  pll('Na', DIAGONAL, ["(R U R' U) (R U R' F') (R U R' U') R' F R2 U' R' U2 R U' R'"]),
  pll('Nb', DIAGONAL, ["R' U R U' R' F' U' F R U R' F R' F' R U' R", "r' D' F r U' r' F' D r2 U r' U' r' F r F'"]),
  pll('Ga', G_PERMS, ["R2 U R' U R' U' R U' R2 U' D R' U R D'", "R2 u R' U R' U' R u' R2 y' R' U R"]),
  pll('Gb', G_PERMS, ["R' U' R U D' R2 U R' U R U' R U' R2 D", "F' U' F R2 u R' U R U' R u' R2"]),
  pll('Gc', G_PERMS, ["R2 U' R U' R U R' U R2 U D' R U' R' D", "R2 F2 R U2 R U2 R' F (R U R' U') R' F R2"]),
  pll('Gd', G_PERMS, ["R U R' U' D R2 U' R U' R' U R' U R2 D'", "R U R' y' R2 u' R U' R' U R' u R2"]),
];
