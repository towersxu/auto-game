// @vitest-environment jsdom
/**
 * Unit tests for the HexMap hexagonal map system.
 * Three.js is mocked so tests run without a real WebGL context.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Three.js mock ────────────────────────────────────────────────────────────

vi.mock('three', () => {
  const makeVec3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set: vi.fn(), copy: vi.fn() });

  const WebGLRenderer = vi.fn(function (this: Record<string, unknown>) {
    const canvas = document.createElement('canvas');
    canvas.width  = 800;
    canvas.height = 600;
    this.domElement     = canvas;
    this.setSize        = vi.fn((w: number, h: number) => { canvas.width = w; canvas.height = h; });
    this.setPixelRatio  = vi.fn();
    this.render         = vi.fn();
    this.dispose        = vi.fn();
    this.shadowMap      = { enabled: false };
    this.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 }));
  });

  const PerspectiveCamera = vi.fn(function (this: Record<string, unknown>) {
    this.aspect = 1;
    this.fov    = 50;
    this.near   = 0.1;
    this.far    = 2000;
    this.position = makeVec3();
    this.up       = makeVec3();
    this.updateProjectionMatrix = vi.fn();
    this.lookAt   = vi.fn();
  });

  const Scene = vi.fn(function (this: Record<string, unknown>) {
    this.add        = vi.fn();
    this.background = null;
    this.fog        = null;
  });

  const Color = vi.fn(function (this: Record<string, unknown>, hex?: number) {
    this._hex = hex ?? 0;
    this.setRGB  = vi.fn().mockReturnThis();
    this.setHex  = vi.fn().mockReturnThis();
    this.setHSL  = vi.fn().mockReturnThis();
    this.getHSL  = vi.fn().mockReturnValue({ h: 0.3, s: 0.5, l: 0.4 });
    this.clone   = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      const c = new (Color as unknown as new () => Record<string, unknown>)();
      Object.assign(c, this);
      return c;
    });
    this.lerp    = vi.fn().mockReturnThis();
  });

  const AmbientLight = vi.fn(function (this: Record<string, unknown>) {});
  const DirectionalLight = vi.fn(function (this: Record<string, unknown>) {
    this.position   = makeVec3();
    this.castShadow = false;
  });

  const InstancedMesh = vi.fn(function (this: Record<string, unknown>) {
    this.castShadow    = false;
    this.receiveShadow = false;
    this.instanceMatrix = { needsUpdate: false };
    this.instanceColor  = { needsUpdate: false };
    this.setMatrixAt = vi.fn();
    this.setColorAt  = vi.fn();
    this.getColorAt  = vi.fn((_, c: Record<string, unknown>) => { c._hex = 0; });
  });

  const Object3D = vi.fn(function (this: Record<string, unknown>) {
    this.position     = makeVec3();
    this.scale        = makeVec3(1, 1, 1);
    this.matrix       = { elements: new Float32Array(16) };
    this.updateMatrix = vi.fn();
  });

  const BufferGeometry = vi.fn(function (this: Record<string, unknown>) {
    this.setAttribute = vi.fn();
    this.setIndex     = vi.fn();
  });
  const Float32BufferAttribute = vi.fn();

  const MeshLambertMaterial = vi.fn();
  const Mesh = vi.fn(function (this: Record<string, unknown>) {
    this.rotation = { x: 0 };
    this.position = makeVec3();
  });

  const PlaneGeometry = vi.fn();
  const LineBasicMaterial = vi.fn();
  const LineSegments = vi.fn(function (this: Record<string, unknown>) {});

  const FogExp2 = vi.fn();
  const Plane = vi.fn(function (this: Record<string, unknown>) {});
  const Vector3 = vi.fn(function (this: Record<string, unknown>, x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
    this.set = vi.fn();
  });

  const Raycaster = vi.fn(function (this: Record<string, unknown>) {
    this.setFromCamera = vi.fn();
    this.ray = { intersectPlane: vi.fn().mockReturnValue(null) };
  });

  return {
    WebGLRenderer,
    PerspectiveCamera,
    Scene,
    Color,
    AmbientLight,
    DirectionalLight,
    InstancedMesh,
    Object3D,
    BufferGeometry,
    Float32BufferAttribute,
    MeshLambertMaterial,
    Mesh,
    PlaneGeometry,
    LineBasicMaterial,
    LineSegments,
    FogExp2,
    Plane,
    Vector3,
    Raycaster,
  };
});

import { HexMap, type HexMapOptions } from './hex-map.js';
import { FogState } from './fog.js';
import { ElevationTier } from './terrain.js';

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth',  { value: width,  configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  return el;
}

// ─── HexMap tests ────────────────────────────────────────────────────────────

describe('HexMap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance', () => {
      const map = new HexMap(container);
      expect(map).toBeInstanceOf(HexMap);
    });

    it('defaults to 50×50 grid', () => {
      const map = new HexMap(container);
      expect(map.cols).toBe(50);
      expect(map.rows).toBe(50);
    });

    it('accepts custom grid size', () => {
      const map = new HexMap(container, { cols: 30, rows: 20 });
      expect(map.cols).toBe(30);
      expect(map.rows).toBe(20);
    });

    it('appends a canvas to the container', () => {
      new HexMap(container);
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('accepts all options without throwing', () => {
      const opts: HexMapOptions = {
        cols: 10, rows: 10, hexSize: 2, seed: 99, riverCount: 3, revealAll: true,
      };
      expect(() => new HexMap(container, opts)).not.toThrow();
    });

    it('revealAll option reveals all fog', () => {
      const map = new HexMap(container, { cols: 5, rows: 5, revealAll: true });
      expect(map.fog.getState(0, 0)).toBe(FogState.VISIBLE);
      expect(map.fog.getState(4, 4)).toBe(FogState.VISIBLE);
    });

    it('fog starts as UNCHARTED without revealAll', () => {
      const map = new HexMap(container, { cols: 5, rows: 5 });
      expect(map.fog.getState(0, 0)).toBe(FogState.UNCHARTED);
    });
  });

  // ── State ─────────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns a state object', () => {
      const map   = new HexMap(container);
      const state = map.getState();
      expect(state).toHaveProperty('targetX');
      expect(state).toHaveProperty('targetZ');
      expect(state).toHaveProperty('distance');
      expect(state).toHaveProperty('pitch');
    });

    it('returns a copy (not a reference)', () => {
      const map = new HexMap(container);
      expect(map.getState()).not.toBe(map.getState());
    });

    it('initial pitch is within [30°, 70°]', () => {
      const map = new HexMap(container);
      const { pitch } = map.getState();
      expect(pitch).toBeGreaterThanOrEqual(Math.PI / 6);
      expect(pitch).toBeLessThanOrEqual((7 * Math.PI) / 18);
    });

    it('initial distance is positive', () => {
      const map = new HexMap(container);
      expect(map.getState().distance).toBeGreaterThan(0);
    });
  });

  // ── Pitch ──────────────────────────────────────────────────────────────────

  describe('setPitch', () => {
    it('clamps to MIN_PITCH when given 0', () => {
      const map = new HexMap(container);
      map.setPitch(0);
      expect(map.getPitch()).toBeCloseTo(Math.PI / 6);
    });

    it('clamps to MAX_PITCH when given π', () => {
      const map = new HexMap(container);
      map.setPitch(Math.PI);
      expect(map.getPitch()).toBeCloseTo((7 * Math.PI) / 18);
    });

    it('accepts a valid pitch within range', () => {
      const map = new HexMap(container);
      map.setPitch(Math.PI / 3);
      expect(map.getPitch()).toBeCloseTo(Math.PI / 3);
    });
  });

  // ── Zoom ───────────────────────────────────────────────────────────────────

  describe('zoom', () => {
    it('zoomIn decreases distance', () => {
      const map    = new HexMap(container);
      const before = map.getState().distance;
      map.zoomIn();
      expect(map.getState().distance).toBeLessThan(before);
    });

    it('zoomOut increases distance', () => {
      const map    = new HexMap(container);
      const before = map.getState().distance;
      map.zoomOut();
      expect(map.getState().distance).toBeGreaterThan(before);
    });

    it('distance never goes below minimum', () => {
      const map = new HexMap(container, { hexSize: 1 });
      for (let i = 0; i < 50; i++) map.zoomIn(2);
      expect(map.getState().distance).toBeGreaterThan(0);
    });
  });

  // ── Pan ────────────────────────────────────────────────────────────────────

  describe('pan', () => {
    it('changes targetX', () => {
      const map   = new HexMap(container);
      const { targetX } = map.getState();
      map.pan(5, 0);
      expect(map.getState().targetX).not.toBe(targetX);
    });

    it('changes targetZ', () => {
      const map   = new HexMap(container);
      const { targetZ } = map.getState();
      map.pan(0, 5);
      expect(map.getState().targetZ).not.toBe(targetZ);
    });
  });

  // ── Fog of war ─────────────────────────────────────────────────────────────

  describe('revealAt', () => {
    it('sets cells to VISIBLE', () => {
      const map = new HexMap(container, { cols: 10, rows: 10 });
      map.revealAt(5, 5, 2);
      expect(map.fog.getState(5, 5)).toBe(FogState.VISIBLE);
    });

    it('reveals cells within radius', () => {
      const map = new HexMap(container, { cols: 10, rows: 10 });
      map.revealAt(5, 5, 2);
      expect(map.fog.getState(4, 5)).toBe(FogState.VISIBLE);
      expect(map.fog.getState(6, 5)).toBe(FogState.VISIBLE);
    });

    it('does not throw when called near boundary', () => {
      const map = new HexMap(container, { cols: 10, rows: 10 });
      expect(() => map.revealAt(0, 0, 3)).not.toThrow();
      expect(() => map.revealAt(9, 9, 3)).not.toThrow();
    });
  });

  // ── Elevation ─────────────────────────────────────────────────────────────

  describe('getElevationTier', () => {
    it('returns a valid ElevationTier for in-bounds cell', () => {
      const map = new HexMap(container, { cols: 10, rows: 10, seed: 1 });
      const tier = map.getElevationTier(5, 5);
      expect(tier).not.toBeNull();
      expect([
        ElevationTier.SUBMERGED,
        ElevationTier.BASELAND,
        ElevationTier.ELEVATED,
        ElevationTier.PEAK,
      ]).toContain(tier);
    });

    it('returns null for out-of-bounds cell', () => {
      const map = new HexMap(container, { cols: 10, rows: 10 });
      expect(map.getElevationTier(-1, 0)).toBeNull();
      expect(map.getElevationTier(0, 10)).toBeNull();
    });
  });

  // ── Resize ────────────────────────────────────────────────────────────────

  describe('resize', () => {
    it('does not throw', () => {
      const map = new HexMap(container);
      expect(() => map.resize(1024, 768)).not.toThrow();
    });
  });

  // ── Render ────────────────────────────────────────────────────────────────

  describe('render', () => {
    it('does not throw', () => {
      const map = new HexMap(container);
      expect(() => map.render()).not.toThrow();
    });
  });

  // ── Dispose ───────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('does not throw', () => {
      const map = new HexMap(container);
      expect(() => map.dispose()).not.toThrow();
    });

    it('removes the canvas from the container', () => {
      const map = new HexMap(container);
      expect(container.querySelector('canvas')).not.toBeNull();
      map.dispose();
      expect(container.querySelector('canvas')).toBeNull();
    });
  });

  // ── Hovered cell ──────────────────────────────────────────────────────────

  describe('getHoveredCell', () => {
    it('returns null initially', () => {
      const map = new HexMap(container);
      expect(map.getHoveredCell()).toBeNull();
    });
  });
});

// ─── FogManager tests ────────────────────────────────────────────────────────

import { FogManager } from './fog.js';

describe('FogManager', () => {
  it('initializes all cells as UNCHARTED', () => {
    const fm = new FogManager(5, 5);
    for (let r = 0; r < 5; r++) {
      for (let q = 0; q < 5; q++) {
        expect(fm.getState(q, r)).toBe(FogState.UNCHARTED);
      }
    }
  });

  it('revealAll sets all cells to VISIBLE', () => {
    const fm = new FogManager(3, 3);
    fm.revealAll();
    expect(fm.getState(0, 0)).toBe(FogState.VISIBLE);
    expect(fm.getState(2, 2)).toBe(FogState.VISIBLE);
  });

  it('revealAt sets the centre cell VISIBLE', () => {
    const fm = new FogManager(10, 10);
    fm.revealAt(5, 5, 2);
    expect(fm.getState(5, 5)).toBe(FogState.VISIBLE);
  });

  it('revealAt converts previously VISIBLE cells to SHROUD', () => {
    const fm = new FogManager(10, 10);
    fm.revealAt(5, 5, 1);
    fm.revealAt(0, 0, 1); // New position far away
    expect(fm.getState(5, 5)).toBe(FogState.SHROUD);
  });

  it('out-of-bounds getState returns UNCHARTED', () => {
    const fm = new FogManager(5, 5);
    expect(fm.getState(-1, 0)).toBe(FogState.UNCHARTED);
    expect(fm.getState(5, 5)).toBe(FogState.UNCHARTED);
  });
});

// ─── Terrain tests ───────────────────────────────────────────────────────────

import { getElevationTier, terrainColor, lerpColor } from './terrain.js';

describe('getElevationTier', () => {
  it('0.0  → SUBMERGED', () => expect(getElevationTier(0.0)).toBe(ElevationTier.SUBMERGED));
  it('0.29 → SUBMERGED', () => expect(getElevationTier(0.29)).toBe(ElevationTier.SUBMERGED));
  it('0.30 → BASELAND',  () => expect(getElevationTier(0.30)).toBe(ElevationTier.BASELAND));
  it('0.49 → BASELAND',  () => expect(getElevationTier(0.49)).toBe(ElevationTier.BASELAND));
  it('0.50 → ELEVATED',  () => expect(getElevationTier(0.50)).toBe(ElevationTier.ELEVATED));
  it('0.71 → ELEVATED',  () => expect(getElevationTier(0.71)).toBe(ElevationTier.ELEVATED));
  it('0.72 → PEAK',      () => expect(getElevationTier(0.72)).toBe(ElevationTier.PEAK));
  it('1.0  → PEAK',      () => expect(getElevationTier(1.00)).toBe(ElevationTier.PEAK));
});

describe('terrainColor', () => {
  it('returns a number', () => {
    expect(typeof terrainColor(0.1)).toBe('number');
  });

  it('SUBMERGED color is blue-ish', () => {
    const c = terrainColor(0.1);
    const b = c & 0xff;
    const g = (c >> 8)  & 0xff;
    const r = (c >> 16) & 0xff;
    // Blue channel should dominate
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('BASELAND color is green-ish', () => {
    const c = terrainColor(0.4);
    const b = c & 0xff;
    const g = (c >> 8)  & 0xff;
    // Green channel should dominate
    expect(g).toBeGreaterThan(b);
  });
});

describe('lerpColor', () => {
  it('t=0 returns colorA', () => expect(lerpColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000));
  it('t=1 returns colorB', () => expect(lerpColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff));
  it('t=0.5 interpolates channels', () => {
    const c = lerpColor(0x000000, 0xffffff, 0.5);
    const r = (c >> 16) & 0xff;
    expect(r).toBeCloseTo(128, -1);
  });
});

// ─── Noise tests ─────────────────────────────────────────────────────────────

import { octaveNoise } from './noise.js';

describe('octaveNoise', () => {
  it('returns a value in [0, 1]', () => {
    for (let i = 0; i < 20; i++) {
      const v = octaveNoise(i * 3.7, i * 2.3, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same inputs', () => {
    expect(octaveNoise(10, 20, 42)).toBe(octaveNoise(10, 20, 42));
  });

  it('differs for different seeds', () => {
    const a = octaveNoise(5, 7, 1);
    const b = octaveNoise(5, 7, 2);
    expect(a).not.toBe(b);
  });

  it('produces variation across the grid', () => {
    const vals = Array.from({ length: 20 }, (_, i) => octaveNoise(i, 0, 42));
    const unique = new Set(vals.map(v => v.toFixed(4)));
    expect(unique.size).toBeGreaterThan(5);
  });
});

// ─── Hex grid tests ───────────────────────────────────────────────────────────

import {
  hexToWorld,
  worldToHex,
  hexDistance,
  getNeighbors,
  hexRound,
  hexCornerWorld,
  getDirectionIndex,
  generateRectGrid,
  hexesInRadius,
} from './hex-grid.js';

describe('hexToWorld / worldToHex round-trip', () => {
  it('round-trips integer axial coords', () => {
    const cases: Array<[number, number]> = [[0,0],[1,0],[0,1],[3,5],[-1,2]];
    for (const [q, r] of cases) {
      const { x, z } = hexToWorld(q, r, 1);
      const back = worldToHex(x, z, 1);
      expect(back.q).toBe(q);
      expect(back.r).toBe(r);
    }
  });
});

describe('hexDistance', () => {
  it('distance to self is 0', () => expect(hexDistance(3, 4, 3, 4)).toBe(0));
  it('adjacent hexes have distance 1', () => {
    expect(hexDistance(0, 0, 1, 0)).toBe(1);
    expect(hexDistance(0, 0, 0, 1)).toBe(1);
  });
  it('is symmetric', () => {
    expect(hexDistance(1, 2, 4, 3)).toBe(hexDistance(4, 3, 1, 2));
  });
});

describe('getNeighbors', () => {
  it('returns exactly 6 neighbors', () => {
    expect(getNeighbors(0, 0).length).toBe(6);
  });

  it('each neighbor is at distance 1', () => {
    for (const n of getNeighbors(2, 3)) {
      expect(hexDistance(2, 3, n.q, n.r)).toBe(1);
    }
  });
});

describe('hexRound', () => {
  it('rounds to nearest integer hex', () => {
    const r = hexRound(0.6, 0.2);
    expect(r.q).toBe(1);
    expect(r.r).toBe(0);
  });

  it('handles exact integers', () => {
    const r = hexRound(2, 3);
    expect(r.q).toBe(2);
    expect(r.r).toBe(3);
  });
});

describe('hexCornerWorld', () => {
  it('corner 0 is at the "north" (-Z direction) for pointy-top', () => {
    const c = hexCornerWorld(0, 0, 1, 0);
    expect(c.x).toBeCloseTo(0);
    expect(c.z).toBeCloseTo(-1);
  });
});

describe('getDirectionIndex', () => {
  it('returns correct direction index for E neighbor', () => {
    expect(getDirectionIndex(0, 0, 1, 0)).toBe(0);
  });

  it('returns -1 for non-adjacent hexes', () => {
    expect(getDirectionIndex(0, 0, 2, 0)).toBe(-1);
  });
});

describe('generateRectGrid', () => {
  it('produces cols × rows hexes', () => {
    expect(generateRectGrid(4, 5).length).toBe(20);
  });

  it('all q in [0, cols)', () => {
    const hexes = generateRectGrid(3, 3);
    for (const { q } of hexes) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThan(3);
    }
  });
});

describe('hexesInRadius', () => {
  it('radius 0 returns only the centre', () => {
    expect(hexesInRadius(1, 1, 0)).toHaveLength(1);
  });

  it('radius 1 returns 7 hexes', () => {
    expect(hexesInRadius(0, 0, 1)).toHaveLength(7);
  });

  it('radius 2 returns 19 hexes', () => {
    expect(hexesInRadius(0, 0, 2)).toHaveLength(19);
  });
});
