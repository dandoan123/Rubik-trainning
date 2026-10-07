import { useEffect, useRef } from 'react';
import { formatMove, type Move } from '../cube/moves';
import { Icon } from './Icon';

export interface SequenceMove {
  move: Move;
  /** Setup turn before the algorithm, the algorithm itself, or the final alignment turn. */
  kind: 'pre' | 'alg' | 'post';
  /** Names the part of a longer solution that starts with this move. */
  label?: string;
}

interface Props {
  sequence: SequenceMove[];
  /** Number of moves already applied. */
  step: number;
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onTurn: (delta: 1 | -1) => void;
  onJump: (step: number) => void;
  onSpeed: (speed: number) => void;
}

export function Player({ sequence, step, playing, speed, onToggle, onTurn, onJump, onSpeed }: Props) {
  const strip = useRef<HTMLOListElement>(null);
  const empty = sequence.length === 0;
  const atStart = step === 0;
  const atEnd = step >= sequence.length;

  // Keep the upcoming move in view when the strip scrolls sideways (small screens), without ever
  // scrolling the page itself.
  useEffect(() => {
    const list = strip.current;
    const chip = list?.children[Math.min(step, sequence.length - 1)] as HTMLElement | undefined;
    if (!list || !chip) return;
    list.scrollTo({ left: chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2 });
  }, [step, sequence]);

  return (
    <div className="player">
      <div className="transport">
        <button className="btn square" aria-label="Về đầu" title="Về đầu" disabled={empty || atStart} onClick={() => onJump(0)}>
          <Icon name="rewind" />
        </button>
        <button
          className="btn square"
          aria-label="Lùi một move"
          title="Lùi một move (←)"
          disabled={empty || atStart}
          onClick={() => onTurn(-1)}
        >
          <Icon name="back" />
        </button>
        <button
          className="btn primary play"
          aria-label={playing ? 'Dừng' : atEnd && !empty ? 'Phát lại' : 'Phát'}
          title="Phát / dừng (phím cách)"
          disabled={empty}
          onClick={onToggle}
        >
          <Icon name={playing ? 'pause' : atEnd && !empty ? 'rewind' : 'play'} />
          <span>{playing ? 'Dừng' : atEnd && !empty ? 'Phát lại' : 'Phát'}</span>
        </button>
        <button
          className="btn square"
          aria-label="Tới một move"
          title="Tới một move (→)"
          disabled={empty || atEnd}
          onClick={() => onTurn(1)}
        >
          <Icon name="forward" />
        </button>
        <label className="speed">
          <span>Tốc độ</span>
          <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))}>
            {[0.5, 1, 2, 4].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        {!empty && (
          <span className="progress" aria-label={`Đã thực hiện ${step} trên ${sequence.length} move`}>
            {step} / {sequence.length}
          </span>
        )}
      </div>
      {empty ? (
        <p className="hint">Nhập trường hợp của bạn để xem công thức chạy trên cube.</p>
      ) : (
        <ol className="sequence" ref={strip}>
          {sequence.map(({ move, kind, label }, i) => (
            <li key={i}>
              {label && <span className="chip-label">{label}</span>}
              <button
                className={['chip', kind, i < step && 'done', i === step && 'next'].filter(Boolean).join(' ')}
                aria-current={i === step ? 'step' : undefined}
                title={kind === 'alg' ? undefined : 'Xoay tầng trên để căn chỉnh (AUF)'}
                onClick={() => onJump(i + 1)}
              >
                {formatMove(move)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
