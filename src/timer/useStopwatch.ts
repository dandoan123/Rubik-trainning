import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Penalty } from './stats';

/**
 * idle -> holding -> ready -> running -> idle, driven by one button (space bar or a finger):
 * hold it until ready, let go to start, press again to stop. With inspection, a first press and
 * release starts the countdown, and the hold-and-release happens inside it.
 */
export type Phase = 'idle' | 'holding' | 'ready' | 'inspecting' | 'running';

/** How long the button must be held before letting go starts the timer. */
export const HOLD_MS = 300;
export const INSPECTION_MS = 15000;
/** Starting up to this long after inspection ran out costs +2; any later is a DNF. */
const OVERTIME_MS = 2000;

export interface Result {
  ms: number;
  penalty: Penalty;
}

export interface Stopwatch {
  phase: Phase;
  /** performance.now() at the start of the solve; meaningful while running. */
  startedAt: RefObject<number>;
  /** performance.now() at the start of inspection, null outside it. */
  inspectedAt: RefObject<number | null>;
  press: () => void;
  release: () => void;
  /** Stops a running solve and reports it. */
  stop: () => void;
  /** Abandons whatever is in progress without recording anything. */
  cancel: () => void;
}

export function useStopwatch(inspection: boolean, onFinish: (result: Result) => void): Stopwatch {
  const [phase, setPhaseState] = useState<Phase>('idle');
  const current = useRef<Phase>('idle');
  const startedAt = useRef(0);
  const inspectedAt = useRef<number | null>(null);
  const penalty = useRef<Penalty>('ok');
  /** A press that starts inspection once released. */
  const armed = useRef(false);
  const holdTimer = useRef(0);
  const overtimeTimer = useRef(0);
  const finish = useRef(onFinish);
  const wantsInspection = useRef(inspection);
  finish.current = onFinish;
  wantsInspection.current = inspection;

  const setPhase = useCallback((next: Phase) => {
    current.current = next;
    setPhaseState(next);
  }, []);

  const cancel = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(overtimeTimer.current);
    armed.current = false;
    inspectedAt.current = null;
    setPhase('idle');
  }, [setPhase]);

  const stop = useCallback(() => {
    if (current.current !== 'running') return;
    const ms = Math.round(performance.now() - startedAt.current);
    setPhase('idle');
    finish.current({ ms, penalty: penalty.current });
  }, [setPhase]);

  const press = useCallback(() => {
    const now = current.current;
    if (now === 'running') return stop();
    if (now === 'idle' && wantsInspection.current) {
      armed.current = true;
      return;
    }
    if (now !== 'idle' && now !== 'inspecting') return;
    setPhase('holding');
    holdTimer.current = window.setTimeout(() => current.current === 'holding' && setPhase('ready'), HOLD_MS);
  }, [setPhase, stop]);

  const release = useCallback(() => {
    if (armed.current) {
      armed.current = false;
      inspectedAt.current = performance.now();
      setPhase('inspecting');
      overtimeTimer.current = window.setTimeout(() => {
        cancel();
        finish.current({ ms: 0, penalty: 'dnf' });
      }, INSPECTION_MS + OVERTIME_MS);
      return;
    }
    if (current.current === 'holding') {
      window.clearTimeout(holdTimer.current);
      setPhase(inspectedAt.current === null ? 'idle' : 'inspecting');
      return;
    }
    if (current.current !== 'ready') return;
    const inspected = inspectedAt.current;
    penalty.current = inspected !== null && performance.now() - inspected > INSPECTION_MS ? '+2' : 'ok';
    window.clearTimeout(overtimeTimer.current);
    inspectedAt.current = null;
    startedAt.current = performance.now();
    setPhase('running');
  }, [cancel, setPhase]);

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(overtimeTimer.current);
    },
    [],
  );

  return { phase, startedAt, inspectedAt, press, release, stop, cancel };
}
