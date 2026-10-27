/**
 * A small, dependency-free 3D graph view on a 2D canvas: perspective
 * projection, painter's-order drawing, drag to rotate, wheel/pinch/keys to
 * zoom, hover and click picking. The /graph page (src/pages/KnowledgeGraph.tsx)
 * imports it lazily, so it is not in the code every other page loads.
 *
 * Why not three.js: the site audit caps ALL shipped JavaScript at 220 kB
 * gzipped, and a WebGL engine alone is most of that. ~150 nodes and ~400
 * edges draw comfortably with canvas 2D; the layout is precomputed at build
 * time (scripts/knowledge-graph.mjs), so nothing is simulated here.
 *
 * The pure helpers (rotate, project, pick) carry the maths and are unit-tested
 * without a DOM; GraphScene wires them to a canvas.
 */

export type Vec3 = readonly [number, number, number];

export interface Camera {
  /** Rotation about the vertical axis, radians. */
  yaw: number;
  /** Rotation about the horizontal axis, radians (clamped to ±PITCH_LIMIT). */
  pitch: number;
  /** Distance from the camera to the centre of the graph (the graph spans the unit ball). */
  distance: number;
  /** The point the camera looks at (graph coordinates). */
  target: Vec3;
}

export interface Projected {
  /** Screen position, CSS pixels. */
  x: number;
  y: number;
  /** Perspective scale at that depth (1 = at the centre's depth). */
  scale: number;
  /** Depth: larger is farther from the camera. */
  depth: number;
  /** False when the point is behind or too close to the camera. */
  visible: boolean;
}

export const PITCH_LIMIT = 1.35;
export const MIN_DISTANCE = 1.25;
export const MAX_DISTANCE = 6;
export const DEFAULT_CAMERA: Camera = { yaw: 0.6, pitch: 0.35, distance: 2.7, target: [0, 0, 0] };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Rotate `p` (relative to the camera target) by yaw, then pitch. */
export function rotate(p: Vec3, cam: Pick<Camera, 'yaw' | 'pitch' | 'target'>): Vec3 {
  const x0 = p[0] - cam.target[0];
  const y0 = p[1] - cam.target[1];
  const z0 = p[2] - cam.target[2];
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = x0 * cy - z0 * sy;
  const z1 = x0 * sy + z0 * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = y0 * cp - z1 * sp;
  const z2 = y0 * sp + z1 * cp;
  return [x1, y2, z2];
}

/** Perspective projection into a `width` × `height` viewport (CSS pixels). */
export function project(p: Vec3, cam: Camera, width: number, height: number): Projected {
  const [x, y, z] = rotate(p, cam);
  const depth = z + cam.distance;
  const focal = Math.min(width, height) * 0.95;
  if (depth < 0.15) return { x: 0, y: 0, scale: 0, depth, visible: false };
  const scale = cam.distance / depth;
  return { x: width / 2 + (x * focal) / depth, y: height / 2 - (y * focal) / depth, scale, depth, visible: true };
}

/**
 * The node under (px, py): the nearest one within its hit radius, preferring
 * the one nearest the camera when several overlap. -1 when none.
 */
export function pick(
  points: readonly Projected[],
  radii: readonly number[],
  px: number,
  py: number,
  isPickable: (i: number) => boolean = () => true,
): number {
  let best = -1;
  let bestDepth = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p?.visible || !isPickable(i)) continue;
    const r = Math.max(8, (radii[i] ?? 0) * p.scale + 4);
    const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d2 <= r * r && p.depth < bestDepth) {
      best = i;
      bestDepth = p.depth;
    }
  }
  return best;
}

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Add `box` to `placed` unless it overlaps a label already there (2px gap). */
export function placeLabel(placed: LabelBox[], box: LabelBox): boolean {
  const gap = 2;
  for (const b of placed) {
    if (box.x < b.x + b.w + gap && b.x < box.x + box.w + gap && box.y < b.y + b.h + gap && b.y < box.y + box.h + gap) {
      return false;
    }
  }
  placed.push(box);
  return true;
}

/** Ease the camera toward `goal` by `t` (0..1); returns true while still moving. */
export function approach(cam: Camera, goal: Camera, t: number): boolean {
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  cam.yaw = lerp(cam.yaw, goal.yaw);
  cam.pitch = lerp(cam.pitch, goal.pitch);
  cam.distance = lerp(cam.distance, goal.distance);
  cam.target = [lerp(cam.target[0], goal.target[0]), lerp(cam.target[1], goal.target[1]), lerp(cam.target[2], goal.target[2])];
  const gap =
    Math.abs(cam.yaw - goal.yaw) +
    Math.abs(cam.pitch - goal.pitch) +
    Math.abs(cam.distance - goal.distance) +
    Math.abs(cam.target[0] - goal.target[0]) +
    Math.abs(cam.target[1] - goal.target[1]) +
    Math.abs(cam.target[2] - goal.target[2]);
  return gap > 1e-3;
}

/* -------------------------------------------------------------------------- */
/* Canvas scene                                                                */
/* -------------------------------------------------------------------------- */

export interface SceneNode {
  position: Vec3;
  label: string;
  /** Base radius in CSS pixels at the centre's depth. */
  radius: number;
  color: string;
  /** Labels of "important" nodes (sections) are always drawn. */
  alwaysLabel: boolean;
}

export interface ScenePalette {
  edge: string;
  edgeStrong: string;
  label: string;
  halo: string;
}

export interface SceneOptions {
  nodes: SceneNode[];
  edges: readonly (readonly [number, number])[];
  neighbours: readonly (readonly number[])[];
  palette: ScenePalette;
  font: string;
  reducedMotion: boolean;
  onHover?: (index: number, x: number, y: number) => void;
  onSelect?: (index: number) => void;
  onOpen?: (index: number) => void;
}

/** Emphasis applied by the page: selection, search matches, hidden types. */
export interface SceneFocus {
  selected: number;
  /** Nodes to dim (not matching the search); empty = none dimmed. */
  dimmed: ReadonlySet<number>;
  /** Nodes not drawn at all (their type is filtered out). */
  hidden: ReadonlySet<number>;
}

const AUTO_ROTATE = 0.0016; /* radians per frame (~5.5°/s at 60 fps) */
const DRAG_RADIANS_PER_PX = 0.006;
const CLICK_SLOP_PX = 5;

export class GraphScene {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private opts: SceneOptions;
  private cam: Camera = { ...DEFAULT_CAMERA };
  private goal: Camera | null = null;
  private focus: SceneFocus = { selected: -1, dimmed: new Set(), hidden: new Set() };
  private hovered = -1;
  private width = 0;
  private height = 0;
  private projected: Projected[] = [];
  private frame = 0;
  private autoRotate: boolean;
  private visible = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; moved: boolean } | null = null;
  private pinchStart = 0;
  private lastTap = 0;
  private readonly cleanups: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D is not available');
    this.canvas = canvas;
    this.ctx = ctx;
    this.opts = opts;
    this.autoRotate = !opts.reducedMotion;
    this.bind();
    this.resize();
    this.request();
  }

  /** Replace nodes' colours/labels/palette (theme change) and redraw. */
  update(opts: Partial<SceneOptions>): void {
    this.opts = { ...this.opts, ...opts };
    this.request();
  }

  setFocus(focus: SceneFocus): void {
    /* A selection made outside the canvas (panel, search) wins over a stale hover. */
    if (focus.selected !== this.focus.selected && this.hovered >= 0 && this.hovered !== focus.selected) {
      this.hovered = -1;
      this.opts.onHover?.(-1, 0, 0);
    }
    this.focus = focus;
    this.request();
  }

  /** Turn slowly until the visitor takes over (never with reduced motion). */
  setAutoRotate(on: boolean): void {
    this.autoRotate = on && !this.opts.reducedMotion;
    this.request();
  }

  isAutoRotating(): boolean {
    return this.autoRotate;
  }

  /** Glide the camera to look at node `i` from closer in. */
  flyTo(i: number): void {
    const node = this.opts.nodes[i];
    if (!node) return;
    this.goal = { ...this.cam, target: node.position, distance: clamp(1.9, MIN_DISTANCE, MAX_DISTANCE) };
    this.request();
  }

  resetView(): void {
    this.goal = { ...DEFAULT_CAMERA, yaw: this.cam.yaw };
    this.request();
  }

  zoomBy(factor: number): void {
    const base = this.goal ?? this.cam;
    this.goal = { ...base, distance: clamp(base.distance * factor, MIN_DISTANCE, MAX_DISTANCE) };
    this.request();
  }

  rotateBy(dyaw: number, dpitch: number): void {
    this.goal = null;
    this.cam.yaw += dyaw;
    this.cam.pitch = clamp(this.cam.pitch + dpitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.request();
  }

  /** Screen position of node `i` (CSS pixels, relative to the canvas), if drawn. */
  screenPosition(i: number): { x: number; y: number } | null {
    const p = this.projected[i];
    return p?.visible ? { x: p.x, y: p.y } : null;
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const off of this.cleanups.splice(0)) off();
  }

  /* -- drawing ------------------------------------------------------------ */

  private request(): void {
    if (this.frame === 0 && this.visible) this.frame = requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    this.frame = 0;
    let moving = false;
    if (this.goal) {
      moving = approach(this.cam, this.goal, 0.12);
      if (!moving) {
        this.cam = { ...this.goal };
        this.goal = null;
      }
    }
    if (this.autoRotate && this.dragStart === null && this.hovered < 0) {
      this.cam.yaw += AUTO_ROTATE;
      if (this.goal) this.goal.yaw += AUTO_ROTATE;
      moving = true;
    }
    this.draw();
    if (moving) this.request();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.request();
  }

  private draw(): void {
    const { ctx, width, height } = this;
    const { nodes, edges, neighbours, palette } = this.opts;
    const { selected, dimmed, hidden } = this.focus;
    ctx.clearRect(0, 0, width, height);
    this.projected = nodes.map((n) => project(n.position, this.cam, width, height));
    const lit = new Set<number>();
    const anchor = this.hovered >= 0 ? this.hovered : selected;
    if (anchor >= 0) {
      lit.add(anchor);
      for (const j of neighbours[anchor] ?? []) lit.add(j);
    }
    const faded = (i: number): boolean => (lit.size > 0 ? !lit.has(i) : dimmed.size > 0 && dimmed.has(i));

    /* Edges first, farthest first, fading with depth. */
    const order = edges
      .map((e, k) => ({ k, depth: ((this.projected[e[0]]?.depth ?? 0) + (this.projected[e[1]]?.depth ?? 0)) / 2 }))
      .sort((a, b) => b.depth - a.depth);
    ctx.lineCap = 'round';
    for (const { k } of order) {
      const [a, b] = edges[k] ?? [0, 0];
      if (hidden.has(a) || hidden.has(b)) continue;
      const pa = this.projected[a];
      const pb = this.projected[b];
      if (!pa?.visible || !pb?.visible) continue;
      const strong = anchor >= 0 && (a === anchor || b === anchor);
      ctx.globalAlpha = strong ? 0.9 : faded(a) || faded(b) ? 0.05 : clamp(0.55 - (pa.depth + pb.depth - 2 * this.cam.distance) * 0.25, 0.08, 0.5);
      ctx.strokeStyle = strong ? palette.edgeStrong : palette.edge;
      ctx.lineWidth = strong ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    /* Nodes, farthest first, then labels on top. */
    const nodeOrder = nodes.map((_, i) => i).sort((a, b) => (this.projected[b]?.depth ?? 0) - (this.projected[a]?.depth ?? 0));
    const labels: number[] = [];
    for (const i of nodeOrder) {
      const p = this.projected[i];
      const n = nodes[i];
      if (!p?.visible || !n || hidden.has(i)) continue;
      const r = Math.max(1.5, n.radius * p.scale);
      ctx.globalAlpha = faded(i) ? 0.15 : clamp(1.15 - (p.depth - this.cam.distance) * 0.35, 0.45, 1);
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (i === selected || i === this.hovered) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = palette.label;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const zoomedIn = p.scale > 1.25 && n.radius >= 5;
      if (lit.has(i) || (lit.size === 0 && (n.alwaysLabel || zoomedIn) && !faded(i))) labels.push(i);
    }
    ctx.globalAlpha = 1;
    ctx.font = this.opts.font;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    /* Most important first (hovered, selected, then bigger and nearer nodes);
     * a label that would overlap one already drawn is skipped. */
    const priority = (i: number): number =>
      (i === this.hovered ? -2e6 : 0) + (i === selected ? -1e6 : 0) - (nodes[i]?.radius ?? 0) * 1000 + (this.projected[i]?.depth ?? 0);
    const placed: LabelBox[] = [];
    for (const i of labels.sort((a, b) => priority(a) - priority(b))) {
      const p = this.projected[i];
      const n = nodes[i];
      if (!p || !n) continue;
      const r = Math.max(1.5, n.radius * p.scale);
      const text = n.label.length > 42 ? `${n.label.slice(0, 41)}…` : n.label;
      const box: LabelBox = { x: p.x + r + 5, y: p.y - 8, w: ctx.measureText(text).width, h: 16 };
      if (!placeLabel(placed, box)) continue;
      ctx.lineWidth = 4;
      ctx.strokeStyle = palette.halo;
      ctx.strokeText(text, box.x, p.y);
      ctx.fillStyle = palette.label;
      ctx.fillText(text, box.x, p.y);
    }
  }

  /* -- input -------------------------------------------------------------- */

  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanups.push(() => target.removeEventListener(type, fn as EventListener, options));
  }

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private pickAt(x: number, y: number): number {
    return pick(this.projected, this.opts.nodes.map((n) => n.radius), x, y, (i) => !this.focus.hidden.has(i));
  }

  private setHovered(i: number, x: number, y: number): void {
    if (i === this.hovered) return;
    this.hovered = i;
    this.canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
    this.opts.onHover?.(i, x, y);
    this.request();
  }

  private bind(): void {
    const c = this.canvas;
    c.style.cursor = 'grab';
    this.on(c, 'pointerdown', (e) => {
      const at = this.local(e);
      this.pointers.set(e.pointerId, at);
      if (this.pointers.size === 1) {
        this.dragStart = { ...at, moved: false };
      } else if (this.pointers.size === 2) {
        const [p, q] = [...this.pointers.values()];
        this.pinchStart = p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
        this.dragStart = null;
      }
      c.setPointerCapture?.(e.pointerId);
    });
    this.on(c, 'pointermove', (e) => {
      const at = this.local(e);
      const prev = this.pointers.get(e.pointerId);
      if (!prev) {
        if (e.pointerType === 'mouse') this.setHovered(this.pickAt(at.x, at.y), at.x, at.y);
        return;
      }
      this.pointers.set(e.pointerId, at);
      if (this.pointers.size === 2) {
        const [p, q] = [...this.pointers.values()];
        const span = p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
        if (this.pinchStart > 0 && span > 0) {
          this.goal = null;
          this.cam.distance = clamp((this.cam.distance * this.pinchStart) / span, MIN_DISTANCE, MAX_DISTANCE);
          this.pinchStart = span;
          this.request();
        }
        return;
      }
      if (!this.dragStart) return;
      if (Math.hypot(at.x - this.dragStart.x, at.y - this.dragStart.y) > CLICK_SLOP_PX) this.dragStart.moved = true;
      if (this.dragStart.moved) {
        this.autoRotate = false;
        this.setHovered(-1, at.x, at.y);
        this.rotateBy((at.x - prev.x) * DRAG_RADIANS_PER_PX, (at.y - prev.y) * DRAG_RADIANS_PER_PX);
        c.style.cursor = 'grabbing';
      }
    });
    const release = (e: PointerEvent): void => {
      const at = this.local(e);
      const drag = this.dragStart;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.dragStart = null;
      c.style.cursor = this.hovered >= 0 ? 'pointer' : 'grab';
      if (e.type !== 'pointerup' || !drag || drag.moved) return;
      const hit = this.pickAt(at.x, at.y);
      const now = performance.now();
      if (hit >= 0 && now - this.lastTap < 350 && hit === this.focus.selected) {
        this.opts.onOpen?.(hit); /* double click / double tap opens the page */
      } else {
        this.opts.onSelect?.(hit);
      }
      this.lastTap = now;
    };
    this.on(c, 'pointerup', release);
    this.on(c, 'pointercancel', release);
    this.on(c, 'pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.pointers.has(e.pointerId)) this.setHovered(-1, 0, 0);
    });
    /* The wheel zooms only once the visitor has engaged with the graph
     * (focused it) or holds Ctrl/⌘, so scrolling past the page never gets
     * trapped by the canvas. */
    this.on(
      c,
      'wheel',
      (e) => {
        if (document.activeElement !== c && !e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.zoomBy(Math.exp(clamp(e.deltaY, -100, 100) * 0.002));
      },
      { passive: false },
    );
    this.on(c, 'keydown', (e) => {
      const step = 0.12;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.rotateBy(-step, 0),
        ArrowRight: () => this.rotateBy(step, 0),
        ArrowUp: () => this.rotateBy(0, -step),
        ArrowDown: () => this.rotateBy(0, step),
        '+': () => this.zoomBy(0.85),
        '=': () => this.zoomBy(0.85),
        '-': () => this.zoomBy(1 / 0.85),
        '0': () => this.resetView(),
      };
      const act = keys[e.key];
      if (!act) return;
      e.preventDefault();
      this.autoRotate = false;
      act();
    });
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(c);
    this.cleanups.push(() => ro.disconnect());
    /* Stop drawing while the canvas is off screen or the tab is hidden. */
    const io = new IntersectionObserver((entries) => {
      this.visible = entries.some((en) => en.isIntersecting) && !document.hidden;
      if (this.visible) this.request();
      else {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    });
    io.observe(c);
    this.cleanups.push(() => io.disconnect());
    const onVisibility = (): void => {
      this.visible = !document.hidden;
      if (this.visible) this.request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }
}
