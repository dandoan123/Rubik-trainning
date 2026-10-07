import { useEffect, useState } from 'react';
import type { CaseEntry } from './data/cases';
import { Finder } from './finder/Finder';
import { TimerView } from './timer/TimerView';

type Page = 'finder' | 'timer';

const PAGES: { id: Page; href: string; label: string }[] = [
  { id: 'finder', href: '#/', label: 'Công thức' },
  { id: 'timer', href: '#/timer', label: 'Timer' },
];

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
        <div className="brand">
          <h1>LL Trainer</h1>
          <p>Tìm công thức tầng 3 thuận tay nhất, bấm giờ và xem lời giải gợi ý</p>
        </div>
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
