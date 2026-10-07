import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { invertMove } from '../cube/moves';
import type { CubeViewHandle } from './CubeView';
import type { SequenceMove } from './Player';

const TURN_MS = 380;

/**
 * Steps a 3D cube through a move sequence: one animated turn at a time, forwards or backwards,
 * or played through. `at` is the number of moves already applied.
 */
export function usePlayback(view: RefObject<CubeViewHandle | null>, sequence: readonly SequenceMove[]) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const turning = useRef(false);
  const at = Math.min(step, sequence.length);

  const turn = useCallback(
    async (delta: 1 | -1) => {
      const index = delta === 1 ? at : at - 1;
      if (turning.current || index < 0 || index >= sequence.length) return;
      const { move } = sequence[index];
      turning.current = true;
      const shown = await view.current?.animateMove(delta === 1 ? move : invertMove(move), TURN_MS / speed);
      turning.current = false;
      if (shown) setStep(delta === 1 ? index + 1 : index);
    },
    [view, at, sequence, speed],
  );

  /** Back to the starting position, stopped. */
  const rewind = useCallback(() => {
    setStep(0);
    setPlaying(false);
  }, []);

  const stepBy = (delta: 1 | -1) => {
    setPlaying(false);
    void turn(delta);
  };

  /** Shows the position after `count` moves, without animating. */
  const jump = (count: number) => {
    setPlaying(false);
    setStep(count);
  };

  const toggle = () => {
    if (!sequence.length) return;
    if (!playing && at >= sequence.length) setStep(0);
    setPlaying(!playing);
  };

  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!playing) return;
    if (at >= sequence.length) {
      setPlaying(false);
      return;
    }
    // Hold the starting position for a moment so it can be taken in before it moves.
    const timer = window.setTimeout(() => void turn(1), at === 0 ? 400 : 40);
    return () => window.clearTimeout(timer);
  }, [playing, at, sequence.length, turn]);

  return { at, playing, speed, setSpeed, toggle, stepBy, jump, rewind, pause };
}
