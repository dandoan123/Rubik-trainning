import { CASES, GROUPS, caseTitle, type AlgSet, type CaseEntry } from '../data/cases';
import { LLDiagram } from './LLDiagram';

interface Props {
  set: AlgSet;
  /** Whether a case shows as selected. */
  pressed: (entry: CaseEntry) => boolean;
  onPick: (entry: CaseEntry) => void;
}

/** Every case of a set as a thumbnail button, grouped by shape. */
export function CaseGallery({ set, pressed, onPick }: Props) {
  return (
    <>
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
                  aria-pressed={pressed(entry)}
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
    </>
  );
}
