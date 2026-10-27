/**
 * The maths under the /graph view (src/lib/graph3d.ts): projection, picking,
 * camera easing and label placement. The canvas wiring (GraphScene) is
 * exercised in a real browser by the e2e suite.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA,
  MAX_DISTANCE,
  MIN_DISTANCE,
  approach,
  clamp,
  pick,
  placeLabel,
  project,
  rotate,
  type Camera,
  type LabelBox,
  type Projected,
} from './graph3d';

const cam = (over: Partial<Camera> = {}): Camera => ({ yaw: 0, pitch: 0, distance: 3, target: [0, 0, 0], ...over });

describe('rotate', () => {
  it('is the identity with no rotation', () => {
    expect(rotate([0.2, -0.4, 0.6], cam())).toEqual([0.2, -0.4, 0.6]);
  });
  it('turns a quarter around the vertical axis', () => {
    const [x, y, z] = rotate([1, 0, 0], cam({ yaw: Math.PI / 2 }));
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });
  it('rotates around the camera target', () => {
    expect(rotate([1, 1, 1], cam({ target: [1, 1, 1], yaw: 1, pitch: 0.5 }))).toEqual([0, 0, 0]);
  });
});

describe('project', () => {
  it('puts the target at the centre of the viewport', () => {
    const p = project([0, 0, 0], cam(), 800, 600);
    expect(p).toMatchObject({ x: 400, y: 300, scale: 1, visible: true });
  });
  it('draws nearer points bigger, and y up', () => {
    const near = project([0, 0.5, -1], cam(), 800, 600);
    const far = project([0, 0.5, 1], cam(), 800, 600);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.y).toBeLessThan(300);
  });
  it('hides points behind the camera', () => {
    expect(project([0, 0, -5], cam(), 800, 600).visible).toBe(false);
  });
});

describe('pick', () => {
  const pts: Projected[] = [
    { x: 100, y: 100, scale: 1, depth: 3, visible: true },
    { x: 102, y: 101, scale: 1, depth: 2, visible: true },
    { x: 300, y: 300, scale: 1, depth: 3, visible: false },
  ];
  it('returns the node nearest the camera among overlapping hits', () => {
    expect(pick(pts, [6, 6, 6], 101, 100)).toBe(1);
  });
  it('ignores invisible and unpickable nodes, and misses', () => {
    expect(pick(pts, [6, 6, 6], 300, 300)).toBe(-1);
    expect(pick(pts, [6, 6, 6], 101, 100, (i) => i !== 1)).toBe(0);
    expect(pick(pts, [6, 6, 6], 200, 200)).toBe(-1);
  });
});

describe('approach', () => {
  it('converges on the goal and then reports it has stopped', () => {
    const c: Camera = { ...DEFAULT_CAMERA };
    const goal: Camera = { yaw: 2, pitch: -0.5, distance: 2, target: [0.3, 0.1, -0.2] };
    let moving = true;
    for (let i = 0; i < 400 && moving; i++) moving = approach(c, goal, 0.12);
    expect(moving).toBe(false);
    expect(c.distance).toBeCloseTo(2, 2);
    expect(c.target[0]).toBeCloseTo(0.3, 2);
  });
});

describe('placeLabel', () => {
  it('refuses a label that would overlap one already placed', () => {
    const placed: LabelBox[] = [];
    expect(placeLabel(placed, { x: 0, y: 0, w: 50, h: 16 })).toBe(true);
    expect(placeLabel(placed, { x: 40, y: 5, w: 50, h: 16 })).toBe(false);
    expect(placeLabel(placed, { x: 0, y: 30, w: 50, h: 16 })).toBe(true);
    expect(placed).toHaveLength(2);
  });
});

describe('limits', () => {
  it('keeps zoom inside a sane range', () => {
    expect(MIN_DISTANCE).toBeLessThan(DEFAULT_CAMERA.distance);
    expect(MAX_DISTANCE).toBeGreaterThan(DEFAULT_CAMERA.distance);
    expect(clamp(10, MIN_DISTANCE, MAX_DISTANCE)).toBe(MAX_DISTANCE);
  });
});
