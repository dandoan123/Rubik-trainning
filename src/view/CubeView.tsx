import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Move } from '../cube/moves';
import type { CubeState } from '../cube/state';
import { Cube3D } from './Cube3D';

export interface CubeViewHandle {
  /** Resolves to true once the turn has been shown in full. */
  animateMove(move: Move, duration: number): Promise<boolean>;
  setView(side: 'front' | 'back'): void;
}

interface Props {
  state: CubeState;
  clickable: ReadonlySet<number>;
  highlight: number | null;
  onFaceletClick: (facelet: number) => void;
}

export const CubeView = forwardRef<CubeViewHandle, Props>(function CubeView(
  { state, clickable, highlight, onFaceletClick },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const cube = useRef<Cube3D | null>(null);
  const click = useRef(onFaceletClick);
  const [unsupported, setUnsupported] = useState(false);
  click.current = onFaceletClick;

  useEffect(() => {
    try {
      cube.current = new Cube3D(host.current!, (facelet) => click.current(facelet));
    } catch {
      setUnsupported(true);
    }
    return () => {
      cube.current?.dispose();
      cube.current = null;
    };
  }, []);

  useEffect(() => {
    cube.current?.setState(state);
  }, [state]);

  useEffect(() => {
    cube.current?.setClickable(clickable);
  }, [clickable]);

  useEffect(() => {
    cube.current?.setHighlight(highlight);
  }, [highlight]);

  useImperativeHandle(
    ref,
    () => ({
      // Without a 3D view there is nothing to wait for; the step still counts.
      animateMove: (move, duration) => cube.current?.animateMove(move, duration) ?? Promise.resolve(true),
      setView: (side) => cube.current?.setView(side),
    }),
    [],
  );

  return (
    <div ref={host} className="cube-host">
      {unsupported && <p className="cube-fallback">Trình duyệt này không bật WebGL — hãy dùng sơ đồ 2D bên cạnh.</p>}
    </div>
  );
});
