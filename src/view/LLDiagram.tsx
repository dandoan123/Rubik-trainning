import type { KeyboardEvent } from 'react';
import { FACELETS, U, UNKNOWN, type Facelet, type Vec3 } from '../cube/geometry';
import { pllArrows, type CubeState, type PieceArrow } from '../cube/state';
import { COLORS, COLOR_NAMES } from './colors';

// The last layer seen from above, front at the bottom: a 3x3 top face with the side stickers
// folded out around it.
const CELL = 10;
const GAP = 1.2;
const BAR = 4.4;
const PAD = 0.8;
const ORIGIN = PAD + BAR + GAP;
const PITCH = CELL + GAP;
const SPAN = 3 * CELL + 2 * GAP;
const SIZE = 2 * ORIGIN + SPAN;
const HEAD = 3;

const LL_FACELETS = FACELETS.filter((f) => f.pos[1] === 1);

const ACROSS = ['trái', 'giữa', 'phải'];
const DEPTH = ['sau', 'giữa', 'trước'];
const FACE_NAMES = ['mặt trên', 'mặt phải', 'mặt trước', 'mặt dưới', 'mặt trái', 'mặt sau'];

function describe({ face, pos }: Facelet, colour: number) {
  const kind = pos[0] !== 0 && pos[2] !== 0 ? 'Góc' : pos[0] === 0 && pos[2] === 0 ? 'Tâm' : 'Cạnh';
  const where = `${DEPTH[pos[2] + 1]}-${ACROSS[pos[0] + 1]}`;
  return `${kind} ${where}, ô ${FACE_NAMES[face]}: ${COLOR_NAMES[colour] ?? 'chưa biết'}`;
}

function boxOf({ face, pos, normal }: Facelet) {
  const x = ORIGIN + (pos[0] + 1) * PITCH;
  const y = ORIGIN + (pos[2] + 1) * PITCH;
  if (face === U) return { x, y, width: CELL, height: CELL };
  const far = ORIGIN + SPAN + GAP;
  if (normal[2] !== 0) return { x, y: normal[2] > 0 ? far : PAD, width: CELL, height: BAR };
  return { x: normal[0] > 0 ? far : PAD, y, width: BAR, height: CELL };
}

const centreOf = (pos: Vec3) => [ORIGIN + (pos[0] + 1) * PITCH + CELL / 2, ORIGIN + (pos[2] + 1) * PITCH + CELL / 2];

function Arrow({ from, to, both }: PieceArrow) {
  const [x1, y1] = centreOf(from);
  const [x2, y2] = centreOf(to);
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const inset = 2.6;
  const tail = [x1 + ux * inset, y1 + uy * inset];
  const tip = [x2 - ux * inset, y2 - uy * inset];
  const head = ([x, y]: number[], sign: number) => {
    const bx = x - sign * ux * HEAD;
    const by = y - sign * uy * HEAD;
    const wx = -uy * HEAD * 0.5;
    const wy = ux * HEAD * 0.5;
    return `${x},${y} ${bx + wx},${by + wy} ${bx - wx},${by - wy}`;
  };
  const shaftEnd = [tip[0] - ux * HEAD * 0.8, tip[1] - uy * HEAD * 0.8];
  const shaftStart = both ? [tail[0] + ux * HEAD * 0.8, tail[1] + uy * HEAD * 0.8] : tail;
  return (
    <g className="ll-arrow">
      <line x1={shaftStart[0]} y1={shaftStart[1]} x2={shaftEnd[0]} y2={shaftEnd[1]} />
      <polygon points={head(tip, 1)} />
      {both && <polygon points={head(tail, -1)} />}
    </g>
  );
}

interface Props {
  state: CubeState;
  /** Draw where each misplaced piece has to go (PLL). */
  arrows?: boolean;
  /** Facelet awaiting input. */
  highlight?: number | null;
  /** Facelets the app filled in by itself. */
  deduced?: ReadonlySet<number>;
  /** Facelets that respond to a click or to Enter / Space. Without any, the diagram is a picture. */
  clickable?: ReadonlySet<number>;
  onFaceletClick?: (facelet: number) => void;
}

export function LLDiagram({ state, arrows = false, highlight = null, deduced, clickable, onFaceletClick }: Props) {
  const press = (facelet: number) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onFaceletClick?.(facelet);
  };
  return (
    <svg className="ll-diagram" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden={clickable ? undefined : true}>
      <rect className="ll-body" x={ORIGIN - GAP} y={ORIGIN - GAP} width={SPAN + 2 * GAP} height={SPAN + 2 * GAP} rx={2.2} />
      {LL_FACELETS.map((facelet) => {
        const colour = state[facelet.index];
        const active = clickable?.has(facelet.index) ?? false;
        const box = boxOf(facelet);
        const classes = [
          facelet.face === U ? 'll-top' : 'll-side',
          colour === UNKNOWN && 'll-unknown',
          active && 'll-active',
          highlight === facelet.index && 'll-cursor',
        ];
        return (
          <g key={facelet.index}>
            <rect
              {...box}
              rx={1.3}
              className={classes.filter(Boolean).join(' ')}
              fill={colour === UNKNOWN ? undefined : COLORS[colour]}
              {...(active && {
                role: 'button',
                tabIndex: 0,
                'aria-label': describe(facelet, colour),
                onClick: () => onFaceletClick?.(facelet.index),
                onKeyDown: press(facelet.index),
              })}
            />
            {deduced?.has(facelet.index) && (
              <circle className="ll-deduced" cx={box.x + box.width / 2} cy={box.y + box.height / 2} r={1.05} />
            )}
          </g>
        );
      })}
      {arrows && pllArrows(state).map((arrow, i) => <Arrow key={i} {...arrow} />)}
    </svg>
  );
}
