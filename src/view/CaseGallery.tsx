import { CASES, GROUPS, caseTitle, type AlgSet, type CaseEntry } from '../data/cases';
import { LLDiagram } from './LLDiagram';

interface Props {
  set: AlgSet;
  activeId: string | null;
  onPick: (entry: CaseEntry) => void;
}

export function CaseGallery({ set, activeId, onPick }: Props) {
  return (
    <section className="gallery" id="gallery">
      <header>
        <h2>Hoặc chọn nhanh từ {set === 'oll' ? '57 trường hợp OLL' : '21 trường hợp PLL'}</h2>
        <p className="hint">
          Hình vẽ nhìn từ trên xuống, mặt trước ở phía dưới.
          {set === 'pll' && ' Mũi tên chỉ nơi mỗi viên cần đi tới.'}
        </p>
      </header>
      {GROUPS[set].map((group) => (
        <div className="gallery-group" key={group}>
          <h3>{group}</h3>
          <div className="gallery-grid">
            {CASES[set]
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <button
                  key={entry.id}
                  className="thumb"
                  aria-label={caseTitle(entry)}
                  aria-pressed={entry.id === activeId}
                  title={caseTitle(entry)}
                  onClick={() => onPick(entry)}
                >
                  <LLDiagram state={entry.view} arrows={set === 'pll'} />
                  <span>{entry.short}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
