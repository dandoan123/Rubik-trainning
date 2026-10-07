import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { CfopCard } from '../cfop/CfopCard';
import { CASES, CASE_BY_ID, caseTitle, type AlgSet, type CaseEntry } from '../data/cases';
import { CaseGallery } from '../view/CaseGallery';
import { Icon } from '../view/Icon';
import { LLDiagram } from '../view/LLDiagram';
import { CubeNet } from './CubeNet';
import { makeScramble, type ScrambleType } from './scramble';
import { byCase, formatSolve, formatTime, recentAverage, resultOf, rolling, summarize, type Penalty, type Solve } from './stats';
import { loadTimerData, saveTimerData, toCsv, type TimerData } from './store';
import { TrendChart } from './TrendChart';
import { INSPECTION_MS, useStopwatch, type Result, type Stopwatch } from './useStopwatch';
import './timer.css';

const TYPES: { id: ScrambleType; label: string; hint: string }[] = [
  { id: '333', label: '3×3', hint: 'giải cả cube' },
  { id: 'pll', label: 'PLL', hint: 'luyện hoán vị' },
  { id: 'oll', label: 'OLL', hint: 'luyện định hướng' },
];
const PENALTIES: { id: Penalty; label: string }[] = [
  { id: 'ok', label: 'OK' },
  { id: '+2', label: '+2' },
  { id: 'dnf', label: 'DNF' },
];
/** Rows of the solve list shown before asking for the rest. */
const PAGE = 100;

const PROMPTS: Record<Stopwatch['phase'], string> = {
  idle: 'Giữ phím cách — hoặc chạm giữ vào đây — rồi thả ra để bắt đầu',
  holding: 'Giữ thêm chút nữa…',
  ready: 'Thả ra để bắt đầu!',
  inspecting: 'Đang quan sát. Giữ rồi thả để bắt đầu giải',
  running: 'Chạm hoặc bấm phím bất kỳ để dừng · Esc để huỷ lần này',
};

/** The big display. It alone re-renders every frame while something is counting. */
function Clock({ watch, rest }: { watch: Stopwatch; rest: string }) {
  const [, tick] = useReducer((count: number) => count + 1, 0);
  const inspecting = watch.inspectedAt.current !== null;
  const live = watch.phase === 'running' || inspecting;
  useEffect(() => {
    if (!live) return;
    let frame = requestAnimationFrame(function loop() {
      tick();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [live]);

  let text = rest;
  if (watch.phase === 'running') text = formatTime(performance.now() - watch.startedAt.current);
  else if (watch.inspectedAt.current !== null) {
    const left = Math.ceil((INSPECTION_MS - (performance.now() - watch.inspectedAt.current)) / 1000);
    text = left > 0 ? String(left) : '+2';
  } else if (watch.phase !== 'idle') text = '0.00';
  return <output className="clock">{text}</output>;
}

function SolveActions(props: {
  solve: Solve;
  onPenalty: (penalty: Penalty) => void;
  onDelete: () => void;
  onOpenCase: (entry: CaseEntry) => void;
}) {
  const entry = props.solve.caseId ? CASE_BY_ID.get(props.solve.caseId) : undefined;
  return (
    <div className="solve-actions">
      <div className="segmented" role="group" aria-label="Phạt">
        {PENALTIES.map(({ id, label }) => (
          <button key={id} aria-pressed={props.solve.penalty === id} onClick={() => props.onPenalty(id)}>
            {label}
          </button>
        ))}
      </div>
      <button className="btn small" onClick={props.onDelete}>
        <Icon name="clear" /> Xoá
      </button>
      {entry && (
        <button className="btn small" onClick={() => props.onOpenCase(entry)}>
          {caseTitle(entry)} · xem công thức
        </button>
      )}
    </div>
  );
}

interface Props {
  /** False while another page of the app is showing: the keyboard then belongs to that page. */
  active: boolean;
  onOpenCase: (entry: CaseEntry) => void;
}

export function TimerView({ active, onOpenCase }: Props) {
  const [data, setData] = useState(loadTimerData);
  const [stored, setStored] = useState(true);
  const { type, inspection } = data;
  const solves = data.sessions[type];
  const allowed = type === '333' ? null : data.chosen[type];
  const [scramble, setScramble] = useState(() => makeScramble(type, allowed));
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => setStored(saveTimerData(data)), [data]);

  const change = (patch: Partial<TimerData>) => setData((now) => ({ ...now, ...patch }));
  const changeSolves = (edit: (list: Solve[]) => Solve[]) =>
    setData((now) => ({ ...now, sessions: { ...now.sessions, [now.type]: edit(now.sessions[now.type]) } }));
  const setPenalty = (id: string, penalty: Penalty) => changeSolves((list) => list.map((s) => (s.id === id ? { ...s, penalty } : s)));
  const remove = (id: string) => changeSolves((list) => list.filter((s) => s.id !== id));

  const record = ({ ms, penalty }: Result) => {
    const solve: Solve = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ms, penalty, scramble: scramble.text, at: Date.now() };
    if (scramble.caseId) solve.caseId = scramble.caseId;
    changeSolves((list) => [...list, solve]);
    setScramble(makeScramble(type, allowed));
  };
  const watch = useStopwatch(inspection, record);

  const switchType = (next: ScrambleType) => {
    change({ type: next });
    setScramble(makeScramble(next, next === '333' ? null : data.chosen[next]));
    setOpen(null);
    setShowAll(false);
    setConfirmClear(false);
  };

  const choose = (set: AlgSet, ids: string[] | null) => {
    change({ chosen: { ...data.chosen, [set]: ids } });
    setScramble(makeScramble(set, ids));
  };
  const toggleCase = (entry: CaseEntry) => {
    const all = CASES[entry.set].map((item) => item.id);
    const now = new Set(data.chosen[entry.set] ?? all);
    if (!now.delete(entry.id)) now.add(entry.id);
    // Practising nothing makes no sense, so the last case cannot be switched off.
    if (now.size) choose(entry.set, now.size === all.length ? null : all.filter((id) => now.has(id)));
  };

  // Leaving the page abandons a solve in progress rather than letting it run unseen.
  const { cancel } = watch;
  useEffect(() => {
    if (!active) cancel();
  }, [active, cancel]);

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (watch.phase === 'running') {
        if (event.key === ' ') event.preventDefault();
        if (event.repeat) return;
        if (event.key === 'Escape') watch.cancel();
        else watch.stop();
        return;
      }
      if (target.closest('input, select, textarea')) return;
      if (event.key === 'Escape') return watch.cancel();
      if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return;
      // Someone moving through the controls by keyboard uses Space to press them.
      if (target.matches(':focus-visible') && target.closest('button, a, summary, [tabindex]')) return;
      event.preventDefault();
      if (!event.repeat) watch.press();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === ' ') watch.release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [active, watch]);

  // After a mouse or touch press on a control, hand the keyboard back to the timer: otherwise
  // the next Space would press that control again instead of starting a solve.
  const releaseFocus = (event: MouseEvent) => {
    const focused = document.activeElement;
    if (event.detail === 0 || !(focused instanceof HTMLElement)) return;
    // A drop-down list closes the moment it loses focus, so it keeps it until a choice is made.
    if (focused instanceof HTMLSelectElement) return;
    focused.blur();
  };
  /** The list a pointer opened. One reached by keyboard keeps its focus, so tabbing can go on from it. */
  const openedList = useRef<EventTarget | null>(null);
  const releaseList = (event: FormEvent) => {
    if (event.target === openedList.current) (event.target as HTMLSelectElement).blur();
  };

  const stats = useMemo(() => {
    const times = solves.map(resultOf);
    return { summary: summarize(solves), ao5: rolling(times, 5, 'average'), ao12: rolling(times, 12, 'average'), cases: byCase(solves) };
  }, [solves]);

  // The solver's pace comes from full solves, whichever kind of scramble is showing.
  const ownAverage = useMemo(() => recentAverage(data.sessions['333']), [data.sessions]);
  const last = solves.at(-1);
  const rows = solves.map((solve, index) => ({ solve, index })).reverse();
  const shown = showAll ? rows : rows.slice(0, PAGE);
  const chosenCount = type === '333' ? 0 : (data.chosen[type]?.length ?? CASES[type].length);

  const download = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([toCsv(solves)], { type: 'text/csv' }));
    link.download = `ll-trainer-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main
      className="timer"
      onClickCapture={releaseFocus}
      onPointerDownCapture={(event) => (openedList.current = event.target instanceof HTMLSelectElement ? event.target : null)}
      onChangeCapture={releaseList}
    >
      <div className="timer-main">
        <section className="card scramble-card">
          <div className="scramble-bar">
            <div className="segmented" role="group" aria-label="Loại scramble">
              {TYPES.map(({ id, label, hint }) => (
                <button key={id} aria-pressed={id === type} title={hint} onClick={() => switchType(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={inspection} onChange={(event) => change({ inspection: event.target.checked })} />
              <span>15 giây quan sát</span>
            </label>
            <button className="btn small" onClick={() => setScramble(makeScramble(type, allowed))}>
              Đề khác
            </button>
          </div>
          <p className="scramble-text">{scramble.text}</p>
          <p className="hint">
            {type === '333'
              ? 'Cầm cube trắng ở trên, xanh lá hướng về bạn rồi xoay theo đề.'
              : 'Từ cube đã giải, cầm vàng ở trên, xanh lá hướng về bạn rồi xoay theo đề.'}
          </p>
          {type !== '333' && (
            <details className="chooser">
              <summary>
                Đang luyện {chosenCount}/{CASES[type].length} trường hợp — bấm để chọn
              </summary>
              <p className="actions">
                <button className="btn small" onClick={() => choose(type, null)}>
                  Chọn tất cả
                </button>
              </p>
              <CaseGallery set={type} pressed={(entry) => !data.chosen[type] || data.chosen[type].includes(entry.id)} onPick={toggleCase} />
            </details>
          )}
        </section>

        <section
          className={`pad ${watch.phase}`}
          aria-label="Đồng hồ"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            watch.press();
          }}
          onPointerUp={watch.release}
          onPointerCancel={watch.cancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Clock watch={watch} rest={last ? formatSolve(last) : '0.00'} />
          <p className="prompt">
            {watch.phase === 'idle' && inspection ? 'Bấm phím cách — hoặc chạm vào đây — để bắt đầu 15 giây quan sát' : PROMPTS[watch.phase]}
          </p>
        </section>

        {last && (
          <section className="card last-solve">
            <span className="hint">Lần vừa rồi</span>
            <SolveActions
              solve={last}
              onPenalty={(penalty) => setPenalty(last.id, penalty)}
              onDelete={() => remove(last.id)}
              onOpenCase={onOpenCase}
            />
          </section>
        )}

        <section className="card">
          <header>
            <h2>Lời giải gợi ý (CFOP)</h2>
            <button className="btn small" aria-pressed={data.showSolution} onClick={() => change({ showSolution: !data.showSolution })}>
              <Icon name="eye" /> {data.showSolution ? 'Đang hiện' : 'Đang ẩn'}
            </button>
          </header>
          {data.showSolution ? (
            <CfopCard
              key={`${scramble.text} ${data.noRotations}`}
              state={scramble.state}
              compare={type === '333'}
              paused={!active || watch.phase !== 'idle'}
              rotations={!data.noRotations}
              onRotations={(allowed) => change({ noRotations: !allowed })}
              pace={data.pace}
              onPace={(pace) => change({ pace })}
              ownAverage={ownAverage}
            />
          ) : (
            <p className="hint">Lời giải đang ẩn để bạn tự giải trước. Bấm nút ở trên khi muốn xem.</p>
          )}
        </section>

        <section className="card">
          <header>
            <h2>Xu hướng</h2>
          </header>
          <TrendChart solves={solves} />
        </section>

        {stats.cases.length > 0 && (
          <section className="card">
            <header>
              <h2>Theo từng trường hợp</h2>
            </header>
            <p className="hint">Chậm nhất ở trên. Bấm vào một dòng để xem công thức của trường hợp đó.</p>
            <table className="case-table">
              <thead>
                <tr>
                  <th scope="col">Trường hợp</th>
                  <th scope="col">Số lần</th>
                  <th scope="col">Trung bình</th>
                  <th scope="col">Tốt nhất</th>
                </tr>
              </thead>
              <tbody>
                {stats.cases.map(({ caseId, count, mean, best }) => {
                  const entry = CASE_BY_ID.get(caseId);
                  return (
                    <tr key={caseId}>
                      <th scope="row">
                        {entry ? (
                          <button className="case-link" onClick={() => onOpenCase(entry)}>
                            <LLDiagram state={entry.view} arrows={entry.set === 'pll'} />
                            {caseTitle(entry)}
                          </button>
                        ) : (
                          caseId
                        )}
                      </th>
                      <td>{count}</td>
                      <td>{formatTime(mean)}</td>
                      <td>{formatTime(best)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <aside className="timer-side">
        <section className="card">
          <header>
            <h2>Thống kê</h2>
          </header>
          <p className="hint">
            {stats.summary.count} lần giải
            {stats.summary.finished < stats.summary.count && ` (${stats.summary.count - stats.summary.finished} DNF)`} · trung bình{' '}
            <b>{formatTime(stats.summary.mean)}</b>
          </p>
          <table className="stat-table">
            <thead>
              <tr>
                <td />
                <th scope="col">Hiện tại</th>
                <th scope="col">Tốt nhất</th>
              </tr>
            </thead>
            <tbody>
              {stats.summary.lines.map(({ label, current, best }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatTime(current)}</td>
                  <td>{formatTime(best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!stored && <p className="hint warn-text">Trình duyệt đang chặn lưu trữ: kết quả sẽ mất khi đóng trang.</p>}
        </section>

        <section className="card">
          <header>
            <h2>Hình scramble</h2>
          </header>
          <CubeNet state={scramble.state} />
        </section>

        <section className="card">
          <header>
            <h2>Các lần giải</h2>
            <button className="btn small" disabled={!solves.length} onClick={download}>
              Xuất CSV
            </button>
            {confirmClear ? (
              <button
                className="btn small danger"
                onClick={() => {
                  changeSolves(() => []);
                  setConfirmClear(false);
                }}
              >
                Xoá cả {solves.length} lần?
              </button>
            ) : (
              <button className="btn small" disabled={!solves.length} onClick={() => setConfirmClear(true)}>
                Xoá phiên
              </button>
            )}
          </header>
          {solves.length === 0 ? (
            <p className="hint">Chưa có lần giải nào. Xoay cube theo đề rồi bấm giờ lần đầu tiên.</p>
          ) : (
            <>
              <div className="solve-head" aria-hidden="true">
                <span>#</span>
                <span>Thời gian</span>
                <span>ao5</span>
                <span>ao12</span>
              </div>
              <ol className="solves">
                {shown.map(({ solve, index }) => (
                  <li key={solve.id}>
                    <button className="solve-row" aria-expanded={open === solve.id} onClick={() => setOpen(open === solve.id ? null : solve.id)}>
                      <span>{index + 1}</span>
                      <b>{formatSolve(solve)}</b>
                      <span>{formatTime(stats.ao5[index])}</span>
                      <span>{formatTime(stats.ao12[index])}</span>
                    </button>
                    {open === solve.id && (
                      <div className="solve-detail">
                        <p className="scramble-small">{solve.scramble}</p>
                        <p className="hint">{new Date(solve.at).toLocaleString('vi-VN')}</p>
                        <SolveActions
                          solve={solve}
                          onPenalty={(penalty) => setPenalty(solve.id, penalty)}
                          onDelete={() => remove(solve.id)}
                          onOpenCase={onOpenCase}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {rows.length > shown.length && (
                <button className="btn small" onClick={() => setShowAll(true)}>
                  Hiện cả {rows.length} lần
                </button>
              )}
            </>
          )}
        </section>
      </aside>
    </main>
  );
}
