import { useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, formatMove } from '../cube/moves';
import type { CubeState } from '../cube/state';
import { CASE_BY_ID, caseTitle } from '../data/cases';
import { formatTime } from '../timer/stats';
import { COLORS, COLOR_NAMES } from '../view/colors';
import { CubeView, type CubeViewHandle } from '../view/CubeView';
import { Player, type SequenceMove } from '../view/Player';
import { usePlayback } from '../view/usePlayback';
import { PACES, formatEstimate, paceOf, secondsFor, subLabel, typicalSeconds } from './pace';
import { solveEach, type CfopSolution, type Stage } from './solve';

const NO_FACELETS: ReadonlySet<number> = new Set();
const ignore = () => {};
/** Pace assumed until the solver's own is known or one is chosen: someone averaging about 35 seconds. */
const DEFAULT_PACE = 2;

/** Works through the six solutions a little at a time, so the page (and the clock) stay responsive. */
function useSolutions(state: CubeState, rotations: boolean, paused: boolean, limit: number) {
  const [solutions, setSolutions] = useState<CfopSolution[]>([]);
  const [finished, setFinished] = useState(false);
  const steps = useRef<Generator<CfopSolution> | null>(null);

  useEffect(() => {
    steps.current = solveEach(state, { rotations });
    setSolutions([]);
    setFinished(false);
  }, [state, rotations]);

  useEffect(() => {
    if (paused || finished) return;
    const timer = window.setTimeout(() => {
      let next: IteratorResult<CfopSolution>;
      try {
        next = steps.current!.next();
      } catch {
        // Not a solvable position; there is nothing to suggest.
        return setFinished(true);
      }
      if (next.done) return setFinished(true);
      const solution = next.value;
      setSolutions((list) => [...list, solution]);
      if (solutions.length + 1 >= limit) setFinished(true);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [state, rotations, paused, finished, solutions.length, limit]);

  return { solutions, finished };
}

const turnsOf = (solution: CfopSolution, kinds: Stage['kind'][]) =>
  solution.stages.filter((stage) => kinds.includes(stage.kind)).reduce((sum, stage) => sum + stage.metrics.turns, 0);

const better = (a: CfopSolution, b: CfopSolution) => a.cost - b.cost || a.turns - b.turns;

function stageNames(solution: CfopSolution): string[] {
  let pair = 0;
  return solution.stages.map((stage) => {
    if (stage.kind === 'hold') return 'Cầm cube';
    if (stage.kind === 'cross') return 'Cross';
    if (stage.kind === 'f2l') return `F2L ${++pair}`;
    const entry = stage.caseId ? CASE_BY_ID.get(stage.caseId) : undefined;
    return entry ? caseTitle(entry) : 'Căn tầng trên';
  });
}

const Swatch = ({ colour }: { colour: number }) => <i className="swatch-dot" style={{ background: COLORS[colour] }} />;

interface Props {
  /** The scrambled cube, held the way the scramble was applied. Give each scramble its own `key`. */
  state: CubeState;
  /** A full solve compares all six cross colours; last-layer practice has only one sensible start. */
  compare: boolean;
  /** True while the timer is busy: computing waits and playback stops. */
  paused: boolean;
  /** Whether the suggestion may turn the whole cube once the solve has started. */
  rotations: boolean;
  onRotations: (allowed: boolean) => void;
  /** Pace to estimate times for, in beats per second; null follows the solver's own pace. */
  pace: number | null;
  onPace: (pace: number | null) => void;
  /** What the solver currently averages on full solves, in milliseconds; null while unknown. */
  ownAverage: number | null;
}

/** A suggested CFOP solution for the scramble, played on a 3D cube, with its statistics. */
export function CfopCard({ state, compare, paused, rotations, onRotations, pace, onPace, ownAverage }: Props) {
  const { solutions, finished } = useSolutions(state, rotations, paused, compare ? 6 : 1);
  const [picked, setPicked] = useState<number | null>(null);
  const view = useRef<CubeViewHandle>(null);

  const ranked = useMemo(() => [...solutions].sort(better), [solutions]);
  const solution = ranked.find((item) => item.cross === picked) ?? ranked[0] ?? null;
  const names = useMemo(() => (solution ? stageNames(solution) : []), [solution]);

  const sequence = useMemo<SequenceMove[]>(
    () =>
      solution?.stages.flatMap((stage, s) =>
        stage.moves.map((move, i): SequenceMove => ({ move, kind: stage.kind === 'hold' ? 'pre' : 'alg', label: i === 0 ? names[s] : undefined })),
      ) ?? [],
    [solution, names],
  );
  const frames = useMemo(() => {
    const list = [state];
    for (const { move } of sequence) list.push(applyMove(list[list.length - 1], move));
    return list;
  }, [state, sequence]);

  const playback = usePlayback(view, sequence);
  const { rewind, pause } = playback;
  // The suggestion can change while the other colours are still being worked out.
  useEffect(() => rewind(), [solution, rewind]);
  useEffect(() => {
    if (paused) pause();
  }, [paused, pause]);

  const ownPace = ownAverage === null ? null : paceOf(ownAverage);
  const rate = pace ?? ownPace ?? DEFAULT_PACE;
  const seconds = (effort: number) => secondsFor(effort, rate);

  const options = (
    <div className="cfop-options">
      <label className="check">
        <input type="checkbox" checked={!rotations} onChange={(event) => onRotations(!event.target.checked)} />
        <span>Không xoay cả khối khi giải</span>
      </label>
      <label className="pace">
        <span>Ước tính thời gian cho</span>
        <select
          value={pace ?? (ownPace === null ? DEFAULT_PACE : 'own')}
          onChange={(event) => onPace(event.target.value === 'own' ? null : Number(event.target.value))}
        >
          <option value="own" disabled={ownAverage === null}>
            {ownAverage === null ? 'tốc độ của bạn (cần 5 lần giải 3×3)' : `tốc độ của bạn (trung bình ${formatTime(ownAverage)})`}
          </option>
          {PACES.map((option) => (
            <option key={option} value={option}>
              người giải khoảng {typicalSeconds(option)} giây
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  if (!solution) {
    return (
      <div className="cfop">
        {options}
        <p className="hint">{finished ? 'Không tìm được lời giải cho đề này.' : 'Đang tính lời giải…'}</p>
      </div>
    );
  }

  // Which stage the playback is in, and where each stage starts.
  const starts = solution.stages.map((_, s) => solution.stages.slice(0, s).reduce((sum, stage) => sum + stage.moves.length, 0));
  const current = starts.findLastIndex((start, s) => start <= playback.at && solution.stages[s].moves.length > 0);
  const estimate = seconds(solution.cost);

  return (
    <div className="cfop">
      {options}

      <p className="cfop-estimate">
        Ước tính <b>{formatEstimate(estimate)} giây</b>
        <span className="badge strong">{subLabel(estimate)}</span>
        <span className="hint">
          {solution.turns} move, {rotations ? `${solution.rotations} lần xoay cả khối` : 'không xoay cả khối'}
        </span>
      </p>

      {compare && (
        <>
          <p className="hint">
            {finished ? 'So sánh 6 màu cross — bấm một dòng để xem lời giải đó.' : `Đang tính… ${solutions.length}/6 màu`}
          </p>
          <table className="cfop-compare">
            <thead>
              <tr>
                <th scope="col">Màu cross</th>
                <th scope="col">Cross</th>
                <th scope="col" className="detail">
                  F2L
                </th>
                <th scope="col" className="detail">
                  OLL+PLL
                </th>
                <th scope="col">Tổng</th>
                <th scope="col" className="detail">
                  Nhịp
                </th>
                <th scope="col">Giây</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item, rank) => (
                <tr key={item.cross} className={item === solution ? 'chosen' : undefined}>
                  <th scope="row">
                    <button
                      aria-pressed={item === solution}
                      onClick={() => {
                        setPicked(item.cross);
                        rewind();
                      }}
                    >
                      <Swatch colour={item.cross} />
                      {COLOR_NAMES[item.cross]}
                      {rank === 0 && finished && <span className="badge strong">Đề xuất</span>}
                    </button>
                  </th>
                  <td>{turnsOf(item, ['cross'])}</td>
                  <td className="detail">{turnsOf(item, ['f2l'])}</td>
                  <td className="detail">{turnsOf(item, ['oll', 'pll'])}</td>
                  <td>
                    <b>{item.turns}</b>
                  </td>
                  <td className="detail">{item.cost.toFixed(1)}</td>
                  <td>{formatEstimate(seconds(item.cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="cfop-hold">
        Trước khi bắt đầu, cầm cube: <Swatch colour={solution.cross} />
        <b>{COLOR_NAMES[solution.cross]}</b> ở dưới, <Swatch colour={solution.front} />
        <b>{COLOR_NAMES[solution.front]}</b> hướng về bạn.
      </p>

      <div className="cfop-stage">
        <div className="cube-frame">
          <CubeView ref={view} state={frames[playback.at]} clickable={NO_FACELETS} highlight={null} onFaceletClick={ignore} />
          <div className="views">
            <button className="btn small" onClick={() => view.current?.setView('front')}>
              Mặt trước
            </button>
            <button className="btn small" onClick={() => view.current?.setView('back')}>
              Mặt sau
            </button>
          </div>
          <p className="cfop-caption">{playback.at >= sequence.length ? 'Đã giải xong' : names[Math.max(current, 0)]}</p>
        </div>
        <Player
          sequence={sequence}
          step={playback.at}
          playing={playback.playing}
          speed={playback.speed}
          onToggle={playback.toggle}
          onTurn={playback.stepBy}
          onJump={playback.jump}
          onSpeed={playback.setSpeed}
        />
      </div>

      <table className="cfop-stages">
        <thead>
          <tr>
            <th scope="col">Bước</th>
            <th scope="col">Các move</th>
            <th scope="col">Move</th>
            <th scope="col" className="detail">
              Nhịp
            </th>
            <th scope="col">Giây</th>
          </tr>
        </thead>
        <tbody>
          {solution.stages.map((stage, s) => {
            if (stage.moves.length === 0) return null;
            const counted = stage.kind !== 'hold';
            return (
              <tr key={s} className={s === current && playback.at < sequence.length ? 'chosen' : undefined}>
                <th scope="row">
                  <button onClick={() => playback.jump(starts[s])} title="Xem từ bước này">
                    {names[s]}
                  </button>
                </th>
                <td className="moves">{stage.moves.map(formatMove).join(' ')}</td>
                <td>{counted ? stage.metrics.turns : '–'}</td>
                <td className="detail">{counted ? stage.metrics.cost.toFixed(1) : '–'}</td>
                <td>{counted ? formatEstimate(seconds(stage.metrics.cost)) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Tổng</th>
            <td />
            <td>
              <b>{solution.turns}</b>
            </td>
            <td className="detail">
              <b>{solution.cost.toFixed(1)}</b>
            </td>
            <td>
              <b>{formatEstimate(estimate)}</b>
            </td>
          </tr>
        </tfoot>
      </table>

      <details className="explain">
        <summary>Thời gian được ước tính thế nào</summary>
        <p>
          Mỗi lời giải có một số <b>nhịp</b>: một cú flick R hoặc U là 1 nhịp, move khó hơn và mỗi lần xoay cả khối tính nhiều hơn.
          Thời gian ước tính = số nhịp ÷ tốc độ tay của người giải, tính cả khoảng dừng nhận diện ở mức bình thường của người đó.
        </p>
        <p>
          Tốc độ của một người được suy từ thời gian trung bình của họ, với giả định một lần giải CFOP thông thường tốn khoảng 70
          nhịp. Tốc độ của bạn lấy từ trung bình 12 lần giải 3×3 gần nhất trong Timer. Đây là thời gian nếu thực hiện đúng lời giải
          này, không phải dự đoán cho lần giải tự do.
        </p>
      </details>
    </div>
  );
}
