import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { DNF, formatTime, resultOf, rolling, type Solve } from './stats';

const HEIGHT = 210;
const MARGIN = { top: 12, right: 14, bottom: 24, left: 48 };
/** Only the most recent solves are drawn, so a long session stays readable. */
const WINDOW = 200;

// Fixed order: a series keeps its colour whatever else is drawn. Colours are defined in timer.css.
const SERIES = [
  { label: 'Từng lần', colour: 'var(--series-1)' },
  { label: 'ao5', colour: 'var(--series-2)' },
  { label: 'ao12', colour: 'var(--series-3)' },
];

/** A round step that splits `range` into about `count` parts. */
function niceStep(range: number, count: number) {
  const raw = range / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((step) => raw <= step)!;
}

const tickLabel = (ms: number, step: number) => {
  const text = formatTime(ms);
  return step % 1000 === 0 ? text.slice(0, -3) : step % 100 === 0 ? text.slice(0, -1) : text;
};

const LineKey = ({ colour }: { colour: string }) => <i className="line-key" style={{ background: colour }} />;

/** Times of the session in order, with the rolling averages drawn over them. */
export function TrendChart({ solves }: { solves: readonly Solve[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  /** Position (within the drawn window) the reader is inspecting. */
  const [probe, setProbe] = useState<number | null>(null);

  useEffect(() => {
    const element = frame.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    const times = solves.map(resultOf);
    const first = Math.max(0, times.length - WINDOW);
    const values = [times, rolling(times, 5, 'average'), rolling(times, 12, 'average')].map((list) => list.slice(first));
    // A DNF has no height: it leaves a gap in the line and is named in the tooltip.
    const points = values.map((list) => list.map((value) => (value === null || value === DNF ? null : value)));
    const drawn = points.flat().filter((value): value is number => value !== null);
    return { first, values, points, count: times.length - first, min: Math.min(...drawn), max: Math.max(...drawn), drawable: drawn.length > 1 };
  }, [solves]);

  if (!data.drawable) {
    return (
      <div ref={frame} className="trend">
        <p className="hint">Biểu đồ xu hướng sẽ hiện sau vài lần giải.</p>
      </div>
    );
  }

  const { count, points, values, first } = data;
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const step = niceStep(Math.max(data.max - data.min, 100), 4);
  const low = Math.floor(data.min / step) * step;
  const high = Math.max(Math.ceil(data.max / step) * step, low + step);
  const x = (i: number) => MARGIN.left + (count === 1 ? plotWidth / 2 : (i / (count - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + (1 - (value - low) / (high - low)) * plotHeight;
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step);

  const path = (list: (number | null)[]) =>
    list.map((value, i) => (value === null ? '' : `${list[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(value).toFixed(1)}`)).join('');
  const lastOf = (list: (number | null)[]) => list.findLastIndex((value) => value !== null);

  const probeAt = (event: PointerEvent) => {
    const left = event.currentTarget.getBoundingClientRect().left + MARGIN.left;
    setProbe(Math.min(count - 1, Math.max(0, Math.round(((event.clientX - left) / plotWidth) * (count - 1)))));
  };
  const onKey = (event: KeyboardEvent) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -count, End: count }[event.key];
    if (!move) return;
    event.preventDefault();
    setProbe(Math.min(count - 1, Math.max(0, (probe ?? count - 1) + move)));
  };

  return (
    <div className="trend">
      <ul className="legend">
        {SERIES.map(({ label, colour }, s) => (
          <li key={label}>
            <LineKey colour={colour} />
            {label} <b>{formatTime(values[s].at(-1) ?? null)}</b>
          </li>
        ))}
      </ul>
      <div
        ref={frame}
        className="trend-frame"
        tabIndex={0}
        role="group"
        aria-label={`Biểu đồ thời gian ${count} lần giải gần nhất. Dùng phím mũi tên trái phải để xem từng lần.`}
        onPointerMove={probeAt}
        onPointerDown={probeAt}
        onPointerLeave={() => setProbe(null)}
        onFocus={() => setProbe((now) => now ?? count - 1)}
        onBlur={() => setProbe(null)}
        onKeyDown={onKey}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                <text className="tick" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                  {tickLabel(tick, step)}
                </text>
              </g>
            ))}
            <text className="tick" x={MARGIN.left} y={HEIGHT - 6}>
              lần {first + 1}
            </text>
            <text className="tick" x={width - MARGIN.right} y={HEIGHT - 6} textAnchor="end">
              lần {first + count}
            </text>
            {probe !== null && <line className="crosshair" x1={x(probe)} x2={x(probe)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />}
            {SERIES.map(({ label, colour }, s) => (
              <path key={label} className="series" d={path(points[s])} stroke={colour} />
            ))}
            {SERIES.map(({ label, colour }, s) => {
              const at = probe ?? lastOf(points[s]);
              const value = points[s][at];
              return value == null ? null : <circle key={label} className="marker" cx={x(at)} cy={y(value)} r={5} fill={colour} />;
            })}
          </svg>
        )}
        {probe !== null && (
          <div className="trend-tip" style={{ left: Math.min(Math.max(x(probe), 76), Math.max(width - 76, 76)) }}>
            <span className="tip-title">Lần {first + probe + 1}</span>
            {SERIES.map(({ label, colour }, s) => (
              <span key={label} className="tip-row">
                <LineKey colour={colour} />
                <b>{formatTime(values[s][probe])}</b> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
