import { useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, formatMove } from '../cube/moves';
import type { CubeState } from '../cube/state';
import { CASE_BY_ID, caseTitle } from '../data/cases';
import { COLORS, COLOR_NAMES } from '../view/colors';
import { CubeView, type CubeViewHandle } from '../view/CubeView';
import { Player, type SequenceMove } from '../view/Player';
import { usePlayback } from '../view/usePlayback';
import { solveEach, type CfopSolution, type Stage } from './solve';

const NO_FACELETS: ReadonlySet<number> = new Set();
const ignore = () => {};

/** Works through the six solutions a little at a time, so the page (and the clock) stay responsive. */
function useSolutions(state: CubeState, paused: boolean, limit: number) {
  const [solutions, setSolutions] = useState<CfopSolution[]>([]);
  const [finished, setFinished] = useState(false);
  const steps = useRef<Generator<CfopSolution> | null>(null);

  useEffect(() => {
    steps.current = solveEach(state);
    setSolutions([]);
    setFinished(false);
  }, [state]);

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
  }, [state, paused, finished, solutions.length, limit]);

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
}

/** A suggested CFOP solution for the scramble, played on a 3D cube, with its move statistics. */
export function CfopCard({ state, compare, paused }: Props) {
  const { solutions, finished } = useSolutions(state, paused, compare ? 6 : 1);
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

  if (!solution) return <p className="hint">{finished ? 'Không tìm được lời giải cho đề này.' : 'Đang tính lời giải…'}</p>;

  // Which stage the playback is in, and where each stage starts.
  const starts = solution.stages.map((_, s) => solution.stages.slice(0, s).reduce((sum, stage) => sum + stage.moves.length, 0));
  const current = starts.findLastIndex((start, s) => start <= playback.at && solution.stages[s].moves.length > 0);

  return (
    <div className="cfop">
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
                <th scope="col">Nhịp</th>
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
                  <td>{item.cost.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="cfop-hold">
        Cầm cube: <Swatch colour={solution.cross} />
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
            <th scope="col">Nhịp</th>
          </tr>
        </thead>
        <tbody>
          {solution.stages.map((stage, s) =>
            stage.moves.length === 0 ? null : (
              <tr key={s} className={s === current && playback.at < sequence.length ? 'chosen' : undefined}>
                <th scope="row">
                  <button onClick={() => playback.jump(starts[s])} title="Xem từ bước này">
                    {names[s]}
                  </button>
                </th>
                <td className="moves">{stage.moves.map(formatMove).join(' ')}</td>
                <td>{stage.kind === 'hold' ? '–' : stage.metrics.turns}</td>
                <td>{stage.kind === 'hold' ? '–' : stage.metrics.cost.toFixed(1)}</td>
              </tr>
            ),
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Tổng</th>
            <td className="hint">{solution.rotations ? `${solution.rotations} lần xoay cả cube khi giải` : 'không xoay cube khi giải'}</td>
            <td>
              <b>{solution.turns}</b>
            </td>
            <td>
              <b>{solution.cost.toFixed(1)}</b>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
