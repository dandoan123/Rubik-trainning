import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FACELETS, type Vec3 } from '../cube/geometry';
import { MOVE_DEFS, applyMove, type Move } from '../cube/moves';
import { SOLVED, sameState, type CubeState } from '../cube/state';
import { COLORS } from './colors';

const AXES = ['x', 'y', 'z'] as const;
const FOV = 32;
const HOME = new Vector3(5, 5.2, 7.4);
const FORWARD = new Vector3(0, 0, 1);
const STICKER_LIFT = 0.489;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function traceSquare<T extends Path>(path: T, size: number, radius: number): T {
  const half = size / 2;
  const flat = half - radius;
  path.moveTo(-flat, -half);
  path.lineTo(flat, -half);
  path.quadraticCurveTo(half, -half, half, -flat);
  path.lineTo(half, flat);
  path.quadraticCurveTo(half, half, flat, half);
  path.lineTo(-flat, half);
  path.quadraticCurveTo(-half, half, -half, flat);
  path.lineTo(-half, -flat);
  path.quadraticCurveTo(-half, -half, -flat, -half);
  return path;
}

interface Turn {
  move: Move;
  cubies: Group[];
  axis: (typeof AXES)[number];
  angle: number;
  start: number;
  duration: number;
  finish: (completed: boolean) => void;
}

/**
 * Draws a cube state and animates single moves. The cubies never really move: a turn spins the
 * affected layer, then the stickers are repainted from the new state and the layer snaps back.
 */
export class Cube3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 1, 60);
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly pivot = new Group();
  private readonly cubies: Group[] = [];
  private readonly stickers: Mesh<ShapeGeometry, MeshStandardMaterial>[] = [];
  private readonly ring: Mesh<ShapeGeometry, MeshBasicMaterial>;
  private readonly raycaster = new Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private state: CubeState = SOLVED;
  private clickable: ReadonlySet<number> = new Set();
  private highlighted: number | null = null;
  private hovered: number | null = null;
  private turn: Turn | null = null;
  private press: { x: number; y: number } | null = null;
  /** Pointer position waiting for a hover test on the next frame. */
  private hover: { clientX: number; clientY: number } | null = null;
  private readonly calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private dirty = true;
  private frame = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly onFaceletClick: (facelet: number) => void,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);

    this.camera.position.copy(HOME);
    this.scene.add(this.camera, this.root, this.pivot, new AmbientLight(0xffffff, 2.1));
    // The key light rides with the camera so the faces in view are always lit.
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-2, 3, 2);
    this.camera.add(key);

    const body = new RoundedBoxGeometry(0.97, 0.97, 0.97, 3, 0.09);
    const plastic = new MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.55 });
    const byPos = new Map<string, Group>();
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        for (const z of [-1, 0, 1]) {
          const cubie = new Group();
          const pos: Vec3 = [x, y, z];
          cubie.position.set(x, y, z);
          cubie.userData.pos = pos;
          cubie.add(new Mesh(body, plastic));
          this.cubies.push(cubie);
          this.root.add(cubie);
          byPos.set(pos.join(), cubie);
        }
      }
    }

    const stickerShape = new ShapeGeometry(traceSquare(new Shape(), 0.84, 0.13), 6);
    for (const facelet of FACELETS) {
      const sticker = new Mesh(stickerShape, new MeshStandardMaterial({ roughness: 0.5 }));
      const normal = new Vector3(...facelet.normal);
      sticker.position.copy(normal).multiplyScalar(STICKER_LIFT);
      sticker.quaternion.setFromUnitVectors(FORWARD, normal);
      sticker.userData.facelet = facelet.index;
      byPos.get(facelet.pos.join())!.add(sticker);
      this.stickers[facelet.index] = sticker;
    }

    const ringShape = traceSquare(new Shape(), 0.97, 0.17);
    ringShape.holes.push(traceSquare(new Path(), 0.76, 0.1));
    this.ring = new Mesh(new ShapeGeometry(ringShape, 6), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    this.ring.raycast = () => {};
    this.ring.visible = false;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = !this.calm;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 16;
    this.controls.addEventListener('change', this.invalidate);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', () => this.setHovered(null));

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.paint();
    this.frame = requestAnimationFrame(this.loop);
  }

  /** Shows a state immediately, abandoning any turn in progress. */
  setState(state: CubeState) {
    if (sameState(state, this.state)) return;
    this.endTurn(false);
    this.state = state;
    this.paint();
  }

  /** Animates one move. Resolves to false if the turn was cut short by setState. */
  animateMove(move: Move, duration: number): Promise<boolean> {
    this.endTurn(true);
    const { axis, slices, dir } = MOVE_DEFS[move.base];
    const cubies = this.cubies.filter((cubie) => slices.includes((cubie.userData.pos as Vec3)[axis]));
    for (const cubie of cubies) this.pivot.add(cubie);
    const quarterTurns = move.amount === 3 ? -1 : move.amount;
    return new Promise((finish) => {
      this.turn = {
        move,
        cubies,
        axis: AXES[axis],
        angle: (dir * quarterTurns * Math.PI) / 2,
        start: performance.now(),
        duration: duration * (move.amount === 2 ? 1.35 : 1),
        finish,
      };
    });
  }

  setClickable(facelets: ReadonlySet<number>) {
    this.clickable = facelets;
    if (this.hovered !== null && !facelets.has(this.hovered)) this.setHovered(null);
  }

  /** Marks one sticker with a pulsing frame (null for none). */
  setHighlight(facelet: number | null) {
    this.highlighted = facelet;
    this.ring.visible = facelet !== null;
    if (facelet !== null) {
      const sticker = this.stickers[facelet];
      sticker.parent!.add(this.ring);
      this.ring.quaternion.copy(sticker.quaternion);
      this.ring.position.copy(sticker.position).multiplyScalar(1.012);
    }
    this.dirty = true;
  }

  /** Moves the camera to look at the front-right or the back-left corner. */
  setView(side: 'front' | 'back') {
    this.camera.position.copy(HOME);
    if (side === 'back') this.camera.position.multiply(new Vector3(-1, 1, -1));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.endTurn(false);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      for (const material of [object.material].flat()) material.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private paint() {
    this.stickers.forEach((sticker, i) => sticker.material.color.set(COLORS[this.state[i]]));
    this.dirty = true;
  }

  private endTurn(completed: boolean) {
    const turn = this.turn;
    if (!turn) return;
    this.turn = null;
    this.pivot.rotation.set(0, 0, 0);
    for (const cubie of turn.cubies) this.root.add(cubie);
    if (completed) {
      this.state = applyMove(this.state, turn.move);
      this.paint();
    }
    this.dirty = true;
    turn.finish(completed);
  }

  private invalidate = () => {
    this.dirty = true;
  };

  /** Lights up the sticker under the pointer when clicking it would do something. */
  private setHovered(facelet: number | null) {
    if (facelet === this.hovered) return;
    if (this.hovered !== null) this.stickers[this.hovered].material.emissive.set(0x000000);
    if (facelet !== null) this.stickers[facelet].material.emissive.set(0x3a3a3a);
    this.hovered = facelet;
    this.renderer.domElement.style.cursor = facelet === null ? 'grab' : 'pointer';
    this.dirty = true;
  }

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    if (this.turn) {
      const progress = Math.min(1, (now - this.turn.start) / this.turn.duration);
      this.pivot.rotation[this.turn.axis] = this.turn.angle * ease(progress);
      this.dirty = true;
      if (progress >= 1) this.endTurn(true);
    }
    if (this.highlighted !== null && !this.calm) {
      this.ring.material.opacity = 0.6 + 0.4 * Math.sin(now / 170);
      this.dirty = true;
    }
    if (this.hover) {
      const facelet = this.pick(this.hover);
      this.setHovered(facelet !== null && this.clickable.has(facelet) ? facelet : null);
      this.hover = null;
    }
    this.controls.update();
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };

  private resize = () => {
    const { clientWidth: width, clientHeight: height } = this.host;
    if (!width || !height) return;
    const aspect = width / height;
    this.renderer.setSize(width, height);
    this.camera.aspect = aspect;
    // On a tall viewport, widen the lens so the cube still fits sideways.
    const half = Math.tan((FOV * Math.PI) / 360) / Math.min(1, aspect);
    this.camera.fov = (Math.atan(half) * 360) / Math.PI;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  };

  private pick(event: { clientX: number; clientY: number }): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const point = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    this.raycaster.setFromCamera(point, this.camera);
    const facelet = this.raycaster.intersectObject(this.root)[0]?.object.userData.facelet;
    return typeof facelet === 'number' ? facelet : null;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.press = { x: event.clientX, y: event.clientY };
  };

  // A press that barely moved is a click on a sticker; anything longer was a drag to orbit.
  private onPointerUp = (event: PointerEvent) => {
    const press = this.press;
    this.press = null;
    if (!press || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) return;
    const facelet = this.pick(event);
    if (facelet !== null && this.clickable.has(facelet)) this.onFaceletClick(facelet);
  };

  // Only remember where the pointer is; the frame loop does the hit test, at most once per frame.
  private onPointerMove = (event: PointerEvent) => {
    if (!event.buttons) this.hover = { clientX: event.clientX, clientY: event.clientY };
  };
}
