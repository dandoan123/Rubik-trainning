import type { CaseDef } from './types';

const CROSS = 'Cross — đã có dấu cộng';
const DOT = 'Dot — chưa có cạnh nào';
const SQUARE = 'Square — hình vuông';
const LIGHTNING = 'Lightning — tia chớp';
const FISH = 'Fish — con cá';
const KNIGHT = 'Knight — nước mã';
const AWKWARD = 'Awkward';
const P_SHAPE = 'Chữ P';
const W_SHAPE = 'Chữ W';
const T_SHAPE = 'Chữ T';
const C_SHAPE = 'Chữ C';
const L_SHAPE = 'Chữ L nhỏ';
const I_SHAPE = 'Chữ I — đường thẳng';
const CORNERS = 'Góc đã đúng hướng';

export const OLL_GROUPS = [
  CROSS,
  T_SHAPE,
  SQUARE,
  C_SHAPE,
  W_SHAPE,
  P_SHAPE,
  I_SHAPE,
  FISH,
  KNIGHT,
  AWKWARD,
  CORNERS,
  L_SHAPE,
  LIGHTNING,
  DOT,
];

const oll = (n: number, group: string, algs: string[], nickname?: string): CaseDef => ({
  id: `OLL ${n}`,
  short: String(n),
  nickname,
  group,
  algs,
});

export const OLL_CASES: CaseDef[] = [
  oll(1, DOT, ["R U2 R2 F R F' U2 (R' F R F')"]),
  oll(2, DOT, ["(F R U R' U' F') (f R U R' U' f')", "r U r' U2 R U2 R' U2 r U' r'"]),
  oll(3, DOT, ["(f R U R' U' f') U' (F R U R' U' F')", "r' R2 U R' U r U2 r' U M'"]),
  oll(4, DOT, ["(f R U R' U' f') U (F R U R' U' F')", "M U' r U2 r' U' R U' R' M'"]),
  oll(5, SQUARE, ["r' U2 R U R' U r", "l' U2 L U L' U l"]),
  oll(6, SQUARE, ["r U2 R' U' R U' r'"]),
  oll(7, LIGHTNING, ["r U R' U R U2 r'"]),
  oll(8, LIGHTNING, ["r' U' R U' R' U2 r", "l' U' L U' L' U2 l"]),
  oll(9, FISH, ["(R U R' U') R' F R2 U R' U' F'"]),
  oll(10, FISH, ["R U R' U (R' F R F') R U2 R'", "R U R' y R' F R U' R' F' R"]),
  oll(11, LIGHTNING, ["r U R' U (R' F R F') R U2 r'", "r' R2 U R' U R U2 R' U M'"]),
  oll(12, LIGHTNING, ["(F R U R' U' F') U (F R U R' U' F')", "M' R' U' R U' R' U2 R U' R r'"]),
  oll(13, KNIGHT, ["F U R U' R2 F' R U R U' R'", "r U' r' U' r U r' F' U F"]),
  oll(14, KNIGHT, ["R' F R U R' F' R F U' F'"]),
  oll(15, KNIGHT, ["r' U' r (R' U' R U) r' U r", "l' U' l (L' U' L U) l' U l"]),
  oll(16, KNIGHT, ["r U r' (R U R' U') r U' r'"]),
  oll(17, DOT, ["R U R' U (R' F R F') U2 (R' F R F')", "F R' F' R2 r' U R U' R' U' M'"]),
  oll(18, DOT, ["r U R' U R U2 r2 U' R U' R' U2 r", "R U2 R2 F R F' U2 M' U R U' r'"]),
  oll(19, DOT, ["r' R U (R U R' U') M' (R' F R F')", "M U (R U R' U') M' (R' F R F')"]),
  oll(20, DOT, ["r U R' U' M2 U R U' R' U' M'", "M U (R U R' U') M2 U R U' r'"]),
  oll(21, CROSS, ["R U2 R' U' R U R' U' R U' R'", "R U R' U R U' R' U R U2 R'"], 'H'),
  oll(22, CROSS, ["R U2 R2 U' R2 U' R2 U2 R", "(f R U R' U' f') (F R U R' U' F')"], 'Pi'),
  oll(23, CROSS, ["R2 D R' U2 R D' R' U2 R'", "R2 D' R U2 R' D R U2 R"], 'Headlights'),
  oll(24, CROSS, ["(r U R' U') (r' F R F')", "L F R' F' L' F R F'"], 'Chameleon'),
  oll(25, CROSS, ["F' (r U R' U') r' F R", "R' F R B' R' F' R B", "F R' F' r U R U' r'"], 'Bowtie'),
  oll(26, CROSS, ["R U2 R' U' R U' R'", "R' U' R U' R' U2 R", "L' U' L U' L' U2 L"], 'Antisune'),
  oll(27, CROSS, ["R U R' U R U2 R'", "L' U2 L U L' U L", "R' U2 R U R' U R"], 'Sune'),
  oll(28, CORNERS, ["(r U R' U') r' R U R U' R'", "(r U R' U') M U R U' R'"]),
  oll(29, AWKWARD, ["(R U R' U') R U' R' F' U' F R U R'", "M U (R U R' U') (R' F R F') M'", "r2 D' r U r' D r2 U' r' U' r"]),
  oll(30, AWKWARD, ["F R' F R2 U' R' U' R U R' F2", "F U R U2 R' U' R U2 R' U' F'", "r' D' r U' r' D r2 U' r' U r U r'"]),
  oll(31, P_SHAPE, ["R' U' F U R U' R' F' R"]),
  oll(32, P_SHAPE, ["L U F' U' L' U L F L'", "S (R U R' U') R' F R f'", "R U B' U' R' U R B R'"]),
  oll(33, T_SHAPE, ["(R U R' U') (R' F R F')"]),
  oll(34, C_SHAPE, ["R U R2 U' R' F R U R U' F'", "(R U R' U') B' (R' F R F') B"]),
  oll(35, FISH, ["R U2 R2 F R F' R U2 R'"]),
  oll(36, W_SHAPE, ["L' U' L U' L' U L U L F' L' F", "R' U' R U' R' U R U R B' R' B"]),
  oll(37, FISH, ["F R' F' R U R U' R'", "F R U' R' U' R U R' F'"]),
  oll(38, W_SHAPE, ["R U R' U R U' R' U' (R' F R F')"]),
  oll(39, LIGHTNING, ["L F' L' U' L U F U' L'", "R U R' F' U' F U R U2 R'"]),
  oll(40, LIGHTNING, ["R' F R U R' U' F' U R"]),
  oll(41, AWKWARD, ["(R U R' U R U2 R') (F R U R' U' F')"]),
  oll(42, AWKWARD, ["(R' U' R U' R' U2 R) (F R U R' U' F')"]),
  oll(43, P_SHAPE, ["F' U' L' U L F", "R' U' F' U F R", "f' L' U' L U f"]),
  oll(44, P_SHAPE, ["F U R U' R' F'", "f R U R' U' f'"]),
  oll(45, T_SHAPE, ["F (R U R' U') F'"]),
  oll(46, C_SHAPE, ["R' U' (R' F R F') U R"]),
  oll(47, L_SHAPE, ["F' (L' U' L U) (L' U' L U) F", "R' U' (R' F R F') (R' F R F') U R"]),
  oll(48, L_SHAPE, ["F (R U R' U') (R U R' U') F'"]),
  oll(49, L_SHAPE, ["r U' r2 U r2 U r2 U' r", "R B' R2 F R2 B R2 F' R"]),
  oll(50, L_SHAPE, ["r' U r2 U' r2 U' r2 U r'"]),
  oll(51, I_SHAPE, ["F (U R U' R') (U R U' R') F'", "f (R U R' U') (R U R' U') f'"]),
  oll(52, I_SHAPE, ["R U R' U R U' B U' B' R'", "R' U' R U' R' U F' U F R", "R U R' U R d' R U' R' F'"]),
  oll(53, L_SHAPE, ["r' U' R U' R' U R U' R' U2 r", "l' U2 L U L' U' L U L' U l"]),
  oll(54, L_SHAPE, ["r U R' U R U' R' U R U2 r'", "r U2 R' U' R U R' U' R U' r'"]),
  oll(55, I_SHAPE, ["R U2 R2 U' R U' R' U2 F R F'", "R' F R U R U' R2 F' R2 U' R' U R U R'"]),
  oll(56, I_SHAPE, ["r U r' (U R U' R') (U R U' R') r U' r'", "r' U' r (U' R' U R) (U' R' U R) r' U r"]),
  oll(57, CORNERS, ["(R U R' U') M' U R U' r'"]),
];
