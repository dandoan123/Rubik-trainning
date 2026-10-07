import { useEffect, useState } from 'react';
import type { CaseEntry } from './data/cases';
import { Finder } from './finder/Finder';
import { TimerView } from './timer/TimerView';

type Page = 'finder' | 'timer';

const PAGES: { id: Page; href: string; label: string }[] = [
  { id: 'finder', href: '#/', label: 'Công thức' },
  { id: 'timer', href: '#/timer', label: 'Timer' },
];

// The "LL" of the name as two little cube faces, each with its lit stickers forming an L.
const STICKER = 8;
const PITCH = STICKER + 1.4;
const INSET = 2.6;
const FACE = 2 * INSET + 2 * PITCH + STICKER;
const FACE_STARTS = [0, FACE + 4.5];
const CELLS = [0, 1, 2];
const inLetter = (column: number, row: number) => column === 0 || row === 2;

const Monogram = () => (
  <svg className="monogram" viewBox={`0 0 ${FACE_STARTS[1] + FACE} ${FACE}`} aria-hidden="true">
    {FACE_STARTS.map((start) => (
      <g key={start}>
        <rect className="face" x={start} width={FACE} height={FACE} rx={5.5} />
        {CELLS.flatMap((row) =>
          CELLS.map((column) => (
            <rect
              key={`${column}-${row}`}
              className={inLetter(column, row) ? 'lit' : undefined}
              x={start + INSET + column * PITCH}
              y={INSET + row * PITCH}
              width={STICKER}
              height={STICKER}
              rx={2.2}
            />
          )),
        )}
      </g>
    ))}
  </svg>
);

// The page lives in the URL's hash, so it can be linked to and the back button works, while the
// site stays a single file that any static host can serve.
const pageOf = (hash: string): Page => (hash.startsWith('#/timer') ? 'timer' : 'finder');

export default function App() {
  const [page, setPage] = useState<Page>(() => pageOf(window.location.hash));
  const [request, setRequest] = useState<{ entry: CaseEntry } | null>(null);
  /** Pages opened so far. A page is only built when first visited, then kept. */
  const [opened, setOpened] = useState<Page[]>([page]);
  if (!opened.includes(page)) setOpened([...opened, page]);

  useEffect(() => {
    const follow = () => setPage(pageOf(window.location.hash));
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const openCase = (entry: CaseEntry) => {
    setRequest({ entry });
    window.location.hash = '#/';
  };

  // A visited page stays mounted, so switching back finds everything as it was left.
  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <a className="wordmark" href="#/" aria-label="LL Trainer — về trang Công thức">
            <Monogram />
            <span aria-hidden="true">Trainer</span>
          </a>
        </h1>
        <nav className="nav" aria-label="Trang">
          {PAGES.map(({ id, href, label }) => (
            <a key={id} href={href} aria-current={page === id ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      {opened.includes('finder') && (
        <div hidden={page !== 'finder'}>
          <Finder active={page === 'finder'} request={request} />
        </div>
      )}
      {opened.includes('timer') && (
        <div hidden={page !== 'timer'}>
          <TimerView active={page === 'timer'} onOpenCase={openCase} />
        </div>
      )}
    </div>
  );
}
