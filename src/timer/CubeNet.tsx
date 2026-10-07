import { FACELETS } from '../cube/geometry';
import type { CubeState } from '../cube/state';
import { COLORS } from '../view/colors';

// The six faces unfolded into a cross: U above F, D below it, L and R beside it, B at the far
// right. Each face's rows and columns already read the way the face is seen from outside.
const CELL = 10;
const FACE = 3 * CELL + 3;
const PLACE = [
  [1, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 1],
  [3, 1],
];

/** A flat picture of the whole cube, to check a scramble against. */
export function CubeNet({ state }: { state: CubeState }) {
  return (
    <svg className="cube-net" viewBox={`-1 -1 ${4 * FACE} ${3 * FACE}`} role="img" aria-label="Hình trải của cube sau khi scramble">
      {FACELETS.map(({ index, face }) => {
        const [column, row] = PLACE[face];
        const k = index % 9;
        return (
          <rect
            key={index}
            x={column * FACE + (k % 3) * CELL}
            y={row * FACE + Math.floor(k / 3) * CELL}
            width={CELL - 1}
            height={CELL - 1}
            rx={1.6}
            fill={COLORS[state[index]]}
          />
        );
      })}
    </svg>
  );
}
