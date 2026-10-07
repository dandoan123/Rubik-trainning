import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { B, F, L, R } from '../cube/geometry';
import { U_TURNS, applyMove, formatMove, type Move } from '../cube/moves';
import { LL_PIECES, LL_PIECE_OF, LL_SIDES, ollOrientations } from '../cube/state';
import { caseTitle, type AlgSet, type CaseEntry } from '../data/cases';
import type { Prefs } from '../solver/fingertrick';
import {
  EMPTY_OLL,
  EMPTY_PLL,
  allowedColours,
  clickOll,
  nextOpen,
  readOll,
  readPll,
  type OllInput,
  type OllReading,
  type PllInput,
  type PllReading,
} from '../solver/input';
import { aufToSolve, findSolutions, type Solution } from '../solver/solve';
import { CaseGallery } from '../view/CaseGallery';
import { COLORS, COLOR_NAMES } from '../view/colors';
import { CubeView, type CubeViewHandle } from '../view/CubeView';
import { Icon } from '../view/Icon';
import { LLDiagram } from '../view/LLDiagram';
import { Player, type SequenceMove } from '../view/Player';
import { usePlayback } from '../view/usePlayback';

const NONE: ReadonlySet<number> = new Set();
const OLL_TARGETS: ReadonlySet<number> = new Set(LL_PIECE_OF.keys());
const PLL_TARGETS: ReadonlySet<number> = new Set(LL_SIDES);
/** Side colours in the order they are offered, each with the number key that enters it. */
const PALETTE = [F, R, B, L].map((colour, i) => ({ colour, key: String(i + 1) }));

const SETS: { id: AlgSet; label: string; hint: string }[] = [
  { id: 'oll', label: 'OLL', hint: 'làm vàng mặt trên' },
  { id: 'pll', label: 'PLL', hint: 'hoán vị tầng 3' },
];

type Analysis =
  /** OLL: nothing entered yet, the top is all yellow. */
  | { status: 'empty' }
  /** OLL: what is entered cannot be the whole picture yet. */
  | { status: 'pending'; notes: string[] }
  /** PLL: several positions still fit. */
  | { status: 'open'; remaining: string[] }
  /** PLL: no algorithm needed, at most a turn of the top layer. */
  | { status: 'aligned'; turns: number }
  | { status: 'ok'; entry: CaseEntry; solutions: Solution[] };

function analyseOll(reading: OllReading, prefs: Prefs): Analysis {
  const notes: string[] = [];
  if (!reading.edgesOk) notes.push('Số cạnh chưa vàng ở mặt trên luôn là số chẵn — còn ít nhất một cạnh nữa cần đánh dấu.');
  if (!reading.cornersOk) notes.push('Hướng xoắn của các góc chưa khớp nhau — còn ít nhất một góc nữa cần đánh dấu.');
  if (notes.length) return { status: 'pending', notes };
  if (reading.orientations.every((orientation) => orientation === 0)) return { status: 'empty' };
  const solutions = findSolutions(reading.state, 'oll', prefs);
  return { status: 'ok', entry: solutions[0].entry, solutions };
}

function analysePll(reading: PllReading, prefs: Prefs): Analysis {
  if (!reading.position) {
    return { status: 'open', remaining: [...new Set(reading.candidates.map((c) => c.caseId ?? 'PLL skip'))] };
  }
  if (reading.position.caseId === null) return { status: 'aligned', turns: aufToSolve(reading.state) ?? 0 };
  const solutions = findSolutions(reading.state, 'pll', prefs);
  return { status: 'ok', entry: solutions[0].entry, solutions };
}

function Notice({ tone, children }: { tone: 'info' | 'warn' | 'good'; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`}>
      <Icon name={tone === 'good' ? 'check' : tone} />
      <div>{children}</div>
    </div>
  );
}

function SolutionCard(props: { solution: Solution; rank: number; best: number; active: boolean; onSelect: () => void }) {
  const { alg, algIndex, metrics, pre, post } = props.solution;
  const faces = [...new Set(alg.moves.map((move) => move.base))].filter((base) => !'xyz'.includes(base));
  const facts = [
    `${metrics.turns} move`,
    `dùng ${faces.join(' ')}`,
    metrics.regrips ? `${metrics.regrips} lần regrip` : 'không regrip',
    metrics.rotations ? `${metrics.rotations} lần xoay cube` : null,
  ];
  return (
    <li>
      <button className="solution" aria-pressed={props.active} onClick={props.onSelect}>
        <span className="solution-head">
          <span className="rank">{props.rank + 1}</span>
          {props.rank === 0 && <span className="badge strong">Đề xuất</span>}
          {algIndex === 0 && <span className="badge">Phổ biến nhất</span>}
          <span className="beats">
            ≈ {metrics.cost.toFixed(1)} nhịp
            {props.rank > 0 && <small> (+{(metrics.cost - props.best).toFixed(1)})</small>}
          </span>
        </span>
        <span className="alg">
          {pre > 0 && <span className="auf before">{formatMove(U_TURNS[pre][0])}</span>}
          {alg.text}
          {post > 0 && <span className="auf after">{formatMove(U_TURNS[post][0])}</span>}
        </span>
        <span className="solution-foot">
          <span>{facts.filter(Boolean).join(' · ')}</span>
          {props.active && (
            <span className="watching">
              <Icon name="eye" /> đang xem
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

interface Props {
  /** False while another page of the app is showing: the keyboard then belongs to that page. */
  active: boolean;
  /** A case to load, asked for from elsewhere in the app. A new object asks again. */
  request: { entry: CaseEntry } | null;
}

/** Enter a last-layer case, get the algorithms for it ranked, and watch them on the cube. */
export function Finder({ active, request }: Props) {
  const [set, setSet] = useState<AlgSet>('oll');
  const [ollInput, setOllInput] = useState<OllInput>(EMPTY_OLL);
  const [pllInput, setPllInput] = useState<PllInput>(EMPTY_PLL);
  /** Earlier inputs of each set, most recent last, for undo. */
  const [past, setPast] = useState<{ oll: OllInput[]; pll: PllInput[] }>({ oll: [], pll: [] });
  /** PLL sticker the user chose to (re)enter; otherwise the app asks for the next open one. */
  const [pickedSticker, setPickedSticker] = useState<number | null>(null);
  const [avoidSlices, setAvoidSlices] = useState(false);
  const [choice, setChoice] = useState(0);
  const view = useRef<CubeViewHandle>(null);

  const oll = useMemo(() => readOll(ollInput), [ollInput]);
  const pll = useMemo(() => readPll(pllInput), [pllInput]);
  const analysis = useMemo(
    () => (set === 'oll' ? analyseOll(oll, { avoidSlices }) : analysePll(pll, { avoidSlices })),
    [set, oll, pll, avoidSlices],
  );
  const caseState = set === 'oll' ? oll.state : pll.state;
  const solutions = analysis.status === 'ok' ? analysis.solutions : [];
  const solution = solutions[Math.min(choice, solutions.length - 1)] ?? null;
  const alignTurns = analysis.status === 'aligned' ? analysis.turns : 0;

  const sequence = useMemo<SequenceMove[]>(() => {
    const as = (kind: SequenceMove['kind']) => (move: Move) => ({ move, kind });
    if (!solution) return U_TURNS[alignTurns].map(as('post'));
    return [
      ...U_TURNS[solution.pre].map(as('pre')),
      ...solution.alg.moves.map(as('alg')),
      ...U_TURNS[solution.post].map(as('post')),
    ];
  }, [solution, alignTurns]);

  const frames = useMemo(() => {
    const list = [caseState];
    for (const { move } of sequence) list.push(applyMove(list[list.length - 1], move));
    return list;
  }, [caseState, sequence]);

  const playback = usePlayback(view, sequence);
  const { at, rewind, pause } = playback;
  const cursor = set === 'pll' ? (pickedSticker ?? nextOpen(pll)) : null;
  const cursorFacelet = cursor === null ? null : LL_SIDES[cursor];
  const targets = set === 'oll' ? OLL_TARGETS : PLL_TARGETS;
  const allowed = useMemo(() => (cursor === null ? NONE : allowedColours(pllInput, cursor)), [pllInput, cursor]);
  const deduced = useMemo(() => {
    if (set === 'pll') return new Set(LL_SIDES.filter((_, i) => pll.deduced[i]));
    return new Set(LL_PIECES.flatMap((piece, p) => (oll.deduced[p] ? [piece.facelets[oll.orientations[p]]] : [])));
  }, [set, oll, pll]);

  const restart = () => {
    rewind();
    setChoice(0);
  };

  /** Call before changing a set's input, so the change can be undone. */
  const remember = (which: AlgSet = set) =>
    setPast((stacks) =>
      which === 'oll' ? { ...stacks, oll: [...stacks.oll, ollInput] } : { ...stacks, pll: [...stacks.pll, pllInput] },
    );

  const undo = () => {
    const previous = past[set].length - 1;
    if (previous < 0) return;
    if (set === 'oll') setOllInput(past.oll[previous]);
    else setPllInput(past.pll[previous]);
    setPast({ oll: set === 'oll' ? past.oll.slice(0, -1) : past.oll, pll: set === 'pll' ? past.pll.slice(0, -1) : past.pll });
    setPickedSticker(null);
    restart();
  };

  const clickFacelet = (facelet: number) => {
    if (set === 'pll') {
      const sticker = LL_SIDES.indexOf(facelet);
      if (sticker < 0) return;
      setPickedSticker(sticker);
      rewind();
      return;
    }
    const piece = LL_PIECE_OF.get(facelet);
    if (piece === undefined) return;
    remember();
    setOllInput((input) => clickOll(input, piece, facelet));
    restart();
  };

  const paint = (colour: number | null) => {
    if (cursor === null || pllInput[cursor] === colour) return;
    remember();
    setPllInput((input) => input.map((current, i) => (i === cursor ? colour : current)));
    setPickedSticker(null);
    restart();
  };

  const clearInput = () => {
    remember();
    if (set === 'oll') setOllInput(EMPTY_OLL);
    else setPllInput(EMPTY_PLL);
    setPickedSticker(null);
    restart();
  };

  const pickCase = (entry: CaseEntry) => {
    remember(entry.set);
    if (entry.set === 'oll') setOllInput(ollOrientations(entry.state));
    else setPllInput(LL_SIDES.map((i) => entry.state[i]));
    setSet(entry.set);
    setPickedSticker(null);
    restart();
    window.scrollTo({ top: 0 });
  };

  const switchSet = (next: AlgSet) => {
    setSet(next);
    setPickedSticker(null);
    restart();
  };

  const showGallery = () => document.getElementById('gallery')?.scrollIntoView();

  // Only the latest request matters, and only when it arrives.
  const load = useRef(pickCase);
  load.current = pickCase;
  useEffect(() => {
    if (request) load.current(request.entry);
  }, [request]);

  useEffect(() => {
    if (!active) pause();
  }, [active, pause]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      // A control that already acted on this key (or needs it for typing) keeps it.
      if (event.defaultPrevented || target.closest('input, select, textarea')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === ' ') {
        if (target.closest('button, summary')) return;
        event.preventDefault();
        playback.toggle();
      } else if (event.key === 'ArrowRight') playback.stepBy(1);
      else if (event.key === 'ArrowLeft') playback.stepBy(-1);
      else if (set === 'pll') {
        const entry = PALETTE.find(({ key }) => key === event.key);
        if (entry && allowed.has(entry.colour)) paint(entry.colour);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const entered = pllInput.filter((colour) => colour !== null).length;
  const filledIn = pll.deduced.filter(Boolean).length;

  return (
    <>
      <nav className="tabs" aria-label="Bước giải">
        {SETS.map(({ id, label, hint }) => (
          <button key={id} aria-pressed={id === set} onClick={() => switchSet(id)}>
            <b>{label}</b>
            <small>{hint}</small>
          </button>
        ))}
      </nav>

      <main className="layout">
        <section className="stage" aria-label="Cube 3D và trình phát công thức">
          <div className="cube-frame">
            <CubeView
              ref={view}
              state={frames[at]}
              clickable={at === 0 ? targets : NONE}
              highlight={at === 0 ? cursorFacelet : null}
              onFaceletClick={clickFacelet}
            />
            <div className="views">
              <button className="btn small" onClick={() => view.current?.setView('front')}>
                Mặt trước
              </button>
              <button className="btn small" onClick={() => view.current?.setView('back')}>
                Mặt sau
              </button>
            </div>
            <p className="cube-hint">Kéo để xoay góc nhìn · bấm vào ô để nhập</p>
          </div>
          <Player
            sequence={sequence}
            step={at}
            playing={playback.playing}
            speed={playback.speed}
            onToggle={playback.toggle}
            onTurn={playback.stepBy}
            onJump={playback.jump}
            onSpeed={playback.setSpeed}
          />
        </section>

        <div className="panel">
          <section className="card">
            <header>
              <span className="step-no">1</span>
              <h2>Nhập trường hợp của bạn</h2>
              <button
                className="btn small"
                aria-label="Hoàn tác"
                title="Hoàn tác (Ctrl+Z)"
                disabled={past[set].length === 0}
                onClick={undo}
              >
                <Icon name="undo" /> <span className="label">Hoàn tác</span>
              </button>
              <button className="btn small" aria-label="Làm lại từ đầu" title="Xoá hết và nhập lại" onClick={clearInput}>
                <Icon name="clear" /> <span className="label">Làm lại</span>
              </button>
            </header>
            <p className="hold">
              Cầm cube <b>vàng ở trên, trắng ở dưới</b>
              {set === 'pll' ? (
                <>
                  , <b>tâm xanh lá hướng về bạn</b>.
                </>
              ) : (
                ' — mặt nào hướng về bạn cũng được.'
              )}
            </p>
            <div className={`input-body ${set}`}>
              <figure className="diagram-box">
                <LLDiagram
                  state={caseState}
                  arrows={set === 'pll'}
                  highlight={cursorFacelet}
                  deduced={deduced}
                  clickable={targets}
                  onFaceletClick={clickFacelet}
                />
                <figcaption>Nhìn từ trên · bạn ở cạnh dưới</figcaption>
              </figure>

              {set === 'oll' ? (
                <ul className="howto">
                  <li>
                    Bấm vào <b>ô đang có màu vàng</b> của từng viên chưa đúng — trên cube 3D hoặc trên sơ đồ.
                  </li>
                  <li>Bấm ô ở mặt trên để xoay viên đó sang hướng kế tiếp.</li>
                  <li>
                    Viên cuối cùng app tự suy ra, đánh dấu bằng chấm <i className="dot" />.
                  </li>
                </ul>
              ) : (
                <div className="howto">
                  <p className="ask">{cursor === null ? 'Đã đủ thông tin' : 'Ô đang nhấp nháy có màu gì?'}</p>
                  {cursor !== null && (
                    <div className="palette" role="group" aria-label="Màu của ô đang chọn">
                      {PALETTE.map(({ colour, key }) => (
                        <button
                          key={colour}
                          className="swatch"
                          aria-keyshortcuts={key}
                          disabled={!allowed.has(colour)}
                          onClick={() => paint(colour)}
                        >
                          <span className="swatch-colour" style={{ background: COLORS[colour] }} />
                          <span className="swatch-name">{COLOR_NAMES[colour]}</span>
                          <kbd>{key}</kbd>
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className="known"
                    role="img"
                    aria-label={`Bạn nhập ${entered} ô, app tự điền ${filledIn} ô, còn ${12 - entered - filledIn} ô`}
                  >
                    {pllInput.map((colour, i) => (
                      <span key={i} className={colour !== null ? 'entered' : pll.deduced[i] ? 'deduced' : undefined} />
                    ))}
                  </div>
                  <p className="hint">
                    Bạn nhập <b>{entered}</b> ô · app tự điền <b>{filledIn}</b> ô <i className="dot" /> · còn{' '}
                    <b>{12 - entered - filledIn}</b>.{' '}
                    {cursor === null
                      ? 'Muốn sửa, bấm vào một ô mặt bên.'
                      : 'Màu bị gạch là màu không thể nằm ở ô đó.'}
                  </p>
                  {cursor !== null && pllInput[cursor] !== null && (
                    <button className="btn small" onClick={() => paint(null)}>
                      Xoá màu ô này
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <header>
              <span className="step-no">2</span>
              <h2>Công thức gợi ý</h2>
            </header>

            <div className="results" aria-live="polite">
              {analysis.status === 'empty' && (
                <Notice tone="info">
                  <p>Mặt trên đang vàng hết. Đánh dấu các ô vàng theo cube của bạn để nhận công thức.</p>
                  <p className="actions">
                    <button className="btn small" onClick={showGallery}>
                      <Icon name="list" /> Chọn từ danh sách
                    </button>
                    <button className="btn small" onClick={() => switchSet('pll')}>
                      Cube đã vàng hết mặt trên → sang PLL
                    </button>
                  </p>
                </Notice>
              )}

              {analysis.status === 'pending' && (
                <Notice tone="warn">
                  {analysis.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </Notice>
              )}

              {analysis.status === 'open' && (
                <Notice tone="info">
                  {entered === 0 ? (
                    <>
                      <p>
                        Nhập màu các ô mặt bên của tầng 3. Chỉ cần <b>5 ô ở mặt trước và mặt phải</b> — 7 ô còn lại app
                        tự suy ra.
                      </p>
                      <p className="actions">
                        <button className="btn small" onClick={showGallery}>
                          <Icon name="list" /> Chọn từ danh sách
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Còn <b>{analysis.remaining.length}</b> trường hợp khớp với những gì đã nhập:
                      </p>
                      <p className="remaining">
                        {analysis.remaining.map((id) => (
                          <span key={id}>{id.replace('PLL ', '')}</span>
                        ))}
                      </p>
                    </>
                  )}
                </Notice>
              )}

              {analysis.status === 'aligned' && (
                <Notice tone="good">
                  {analysis.turns === 0 ? (
                    <p>Cube đã giải xong — không cần làm gì thêm.</p>
                  ) : (
                    <p>
                      PLL skip! Chỉ cần xoay tầng trên: <b className="alg-inline">{formatMove(U_TURNS[analysis.turns][0])}</b>
                    </p>
                  )}
                </Notice>
              )}

              {analysis.status === 'ok' && solution && (
                <>
                  <div className="case-name">
                    <b>{caseTitle(analysis.entry)}</b>
                    <span>{analysis.entry.group}</span>
                  </div>
                  <ol className="solutions">
                    {solutions.map((item, rank) => (
                      <SolutionCard
                        key={item.alg.text}
                        solution={item}
                        rank={rank}
                        best={solutions[0].metrics.cost}
                        active={item === solution}
                        onSelect={() => {
                          setChoice(rank);
                          rewind();
                        }}
                      />
                    ))}
                  </ol>
                </>
              )}
            </div>

            <label className="pref">
              <input
                type="checkbox"
                checked={avoidSlices}
                onChange={(event) => {
                  setAvoidSlices(event.target.checked);
                  restart();
                }}
              />
              <span>Tôi không quen xoay lớp giữa (M, S, E) — xếp các công thức đó xuống dưới</span>
            </label>
            <details className="explain">
              <summary>Cách đọc và cách xếp hạng công thức</summary>
              <p>
                <b>Nhịp</b> là ước lượng công sức thực hiện cho người thuận tay phải: một cú flick R hoặc U tính 1 nhịp,
                các mặt khó flick hơn (F, D, L, M, B…) tính nhiều hơn, mỗi lần phải đổi cách cầm (regrip) hoặc xoay cả
                cube bị cộng thêm. Ít nhịp hơn là nhanh hơn.
              </p>
              <p>
                Đây là ước lượng theo mô hình, không phải số đo thực tế: khi hai công thức chênh nhau dưới 1 nhịp, hãy
                thử cả hai và chọn cái tay bạn thấy trơn hơn. <b>Phổ biến nhất</b> là công thức được dạy nhiều nhất.
              </p>
              <p>
                Ô viền nét đứt như <span className="auf">U</span> là cú xoay tầng trên để căn chỉnh trước hoặc sau công
                thức (AUF), tuỳ theo hướng bạn đang cầm cube.
              </p>
            </details>
          </section>
        </div>
      </main>

      <section className="gallery" id="gallery">
        <header>
          <h2>Hoặc chọn nhanh từ {set === 'oll' ? '57 trường hợp OLL' : '21 trường hợp PLL'}</h2>
          <p className="hint">
            Hình vẽ nhìn từ trên xuống, mặt trước ở phía dưới.
            {set === 'pll' && ' Mũi tên chỉ nơi mỗi viên cần đi tới.'}
          </p>
        </header>
        <CaseGallery
          set={set}
          pressed={(entry) => analysis.status === 'ok' && analysis.entry.id === entry.id}
          onPick={pickCase}
        />
      </section>
    </>
  );
}
