// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Floating-point tolerance for grid-edge comparisons (avoids sub-pixel rounding failures). */
const FLOAT_TOLERANCE = 0.001;

// ── Mock Three.js so tests run without a real WebGL context ──────────────────
vi.mock('three', () => {
  // A minimal Vector3-like object that supports .set()
  const makeVec3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set: vi.fn() });

  // Factory for the WebGLRenderer mock; each instance gets its own canvas so
  // that DOM queries on individual containers work correctly.
  const WebGLRenderer = vi.fn(function (this: Record<string, unknown>) {
    const canvas = document.createElement('canvas');
    this.domElement = canvas;
    this.setSize = vi.fn((w: number, h: number) => {
      canvas.width = w;
      canvas.height = h;
    });
    this.setPixelRatio = vi.fn();
    this.render = vi.fn();
    this.dispose = vi.fn();
  });

  const OrthographicCamera = vi.fn(function (this: Record<string, unknown>) {
    this.left = 0; this.right = 0; this.top = 0; this.bottom = 0;
    this.position = makeVec3();
    this.up = makeVec3();
    this.updateProjectionMatrix = vi.fn();
    this.lookAt = vi.fn();
  });

  const Scene = vi.fn(function (this: Record<string, unknown>) {
    this.add = vi.fn();
    this.remove = vi.fn();
    this.background = null;
  });

  const Color = vi.fn();

  const AmbientLight = vi.fn(function (this: Record<string, unknown>) {});

  const DirectionalLight = vi.fn(function (this: Record<string, unknown>) {
    this.position = makeVec3();
  });

  const PlaneGeometry = vi.fn(function (this: Record<string, unknown>) {
    this.dispose = vi.fn();
  });
  const MeshLambertMaterial = vi.fn(function (this: Record<string, unknown>) {
    this.dispose = vi.fn();
  });
  const MeshBasicMaterial = vi.fn(function (this: Record<string, unknown>) {
    this.dispose = vi.fn();
  });
  const Mesh = vi.fn(function (this: Record<string, unknown>) {
    this.rotation = { x: 0 };
    this.position = makeVec3();
    this.geometry = { dispose: vi.fn() };
    this.material = { dispose: vi.fn() };
  });

  const BufferGeometry = vi.fn(function (this: Record<string, unknown>) {
    this.setAttribute = vi.fn();
  });
  const Float32BufferAttribute = vi.fn();
  const LineBasicMaterial = vi.fn();
  const LineSegments = vi.fn();

  return {
    WebGLRenderer,
    OrthographicCamera,
    Scene,
    Color,
    AmbientLight,
    DirectionalLight,
    PlaneGeometry,
    MeshLambertMaterial,
    MeshBasicMaterial,
    Mesh,
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    LineSegments,
  };
});

import { GameMap, MapOptions } from './map';

function makeContainer(width = 800, height = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  return el;
}

describe('GameMap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  // ─── constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a GameMap instance', () => {
      const map = new GameMap(container);
      expect(map).toBeInstanceOf(GameMap);
    });

    it('should use default grid size of 168x168', () => {
      const map = new GameMap(container);
      expect(map.gridWidth).toBe(168);
      expect(map.gridHeight).toBe(168);
    });

    it('should accept custom grid size', () => {
      const map = new GameMap(container, { gridWidth: 64, gridHeight: 32 });
      expect(map.gridWidth).toBe(64);
      expect(map.gridHeight).toBe(32);
    });

    it('should append a canvas element to the container', () => {
      new GameMap(container);
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('should accept all MapOptions without throwing', () => {
      const opts: MapOptions = {
        gridWidth: 50,
        gridHeight: 50,
        cellSize: 20,
        gridColor: 0xffffff,
        groundColor: 0x123456,
      };
      const map = new GameMap(container, opts);
      expect(map.gridWidth).toBe(50);
    });
  });

  // ─── getState ───────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('should return initial state with cellSize set', () => {
      const map = new GameMap(container);
      const state = map.getState();
      expect(state.cellSize).toBeGreaterThan(0);
    });

    it('should return a copy of the state (not a reference)', () => {
      const map = new GameMap(container);
      const state1 = map.getState();
      const state2 = map.getState();
      expect(state1).not.toBe(state2);
    });

    it('initial offsetX should be ≤ 0 (grid left edge ≤ canvas left edge)', () => {
      const map = new GameMap(container);
      expect(map.getState().offsetX).toBeLessThanOrEqual(0);
    });

    it('initial offsetY should be ≤ 0 (grid top edge ≤ canvas top edge)', () => {
      const map = new GameMap(container);
      expect(map.getState().offsetY).toBeLessThanOrEqual(0);
    });
  });

  // ─── fill-canvas invariant ──────────────────────────────────────────────────

  /**
   * The core requirement: the grid must always cover the full canvas.
   * offsetX + gridWidth*cellSize >= canvasWidth
   * offsetY + gridHeight*cellSize >= canvasHeight
   * offsetX <= 0, offsetY <= 0
   */
  function assertFillsCanvas(map: GameMap, canvasWidth: number, canvasHeight: number): void {
    const { offsetX, offsetY, cellSize } = map.getState();
    expect(offsetX).toBeLessThanOrEqual(0);
    expect(offsetY).toBeLessThanOrEqual(0);
    expect(offsetX + map.gridWidth * cellSize).toBeGreaterThanOrEqual(canvasWidth - FLOAT_TOLERANCE);
    expect(offsetY + map.gridHeight * cellSize).toBeGreaterThanOrEqual(canvasHeight - FLOAT_TOLERANCE);
  }

  describe('fill-canvas invariant', () => {
    it('initial state fills the canvas', () => {
      const map = new GameMap(container);
      assertFillsCanvas(map, 800, 600);
    });

    it('after pan the canvas is still filled', () => {
      const map = new GameMap(container);
      const { cellSize } = map.getState();
      // Try a large pan that would expose blank space without clamping
      map.pan(-(map.gridWidth * cellSize), 0);
      assertFillsCanvas(map, 800, 600);
    });

    it('after zoom-out the canvas is still filled', () => {
      const map = new GameMap(container);
      map.zoomOut(0.9); // aggressive zoom-out
      assertFillsCanvas(map, 800, 600);
    });

    it('after zoom-in the canvas is still filled', () => {
      const map = new GameMap(container);
      map.zoomIn(2); // aggressive zoom-in
      assertFillsCanvas(map, 800, 600);
    });

    it('after resize the canvas is still filled', () => {
      const map = new GameMap(container);
      map.resize(1024, 768);
      assertFillsCanvas(map, 1024, 768);
    });

    it('after center the canvas is still filled', () => {
      const map = new GameMap(container);
      map.pan(50, 30);
      map.center();
      assertFillsCanvas(map, 800, 600);
    });
  });

  // ─── pan ────────────────────────────────────────────────────────────────────

  describe('pan', () => {
    it('should update offsetY when panning up (negative deltaY)', () => {
      // The default 168x168 grid is taller than the 800x600 canvas at min zoom,
      // so there IS vertical pan room.
      const map = new GameMap(container);
      const before = map.getState().offsetY;
      map.pan(0, -20);
      expect(map.getState().offsetY).toBeCloseTo(before - 20);
    });

    it('should update offsetX when panning after zoom-in', () => {
      // After zooming in, the grid is wider than the canvas, giving X pan room.
      const map = new GameMap(container);
      map.zoomIn(1);
      const before = map.getState().offsetX;
      map.pan(-20, 0);
      expect(map.getState().offsetX).toBeCloseTo(before - 20);
    });

    it('should clamp offsetX at 0 when panning past right boundary', () => {
      const map = new GameMap(container);
      map.pan(9999, 0);
      expect(map.getState().offsetX).toBe(0);
    });

    it('should clamp offsetX at min when panning past left boundary', () => {
      const map = new GameMap(container);
      map.zoomIn(1); // make horizontal room first
      map.pan(-9999, 0);
      const { offsetX, cellSize } = map.getState();
      expect(offsetX + map.gridWidth * cellSize).toBeGreaterThanOrEqual(800 - FLOAT_TOLERANCE);
    });

    it('should accumulate multiple Y pans', () => {
      const map = new GameMap(container);
      const initial = map.getState().offsetY;
      map.pan(0, -5);
      map.pan(0, -3);
      expect(map.getState().offsetY).toBeCloseTo(initial - 8);
    });
  });

  // ─── center ─────────────────────────────────────────────────────────────────

  describe('center', () => {
    it('should reset to minimum zoom and centered position', () => {
      const map = new GameMap(container);
      map.zoomIn(2);
      map.pan(-100, -80);
      map.center();
      const state = map.getState();
      // After centering, cellSize should be the minimum (covers canvas exactly)
      const minCell = Math.max(800 / map.gridWidth, 600 / map.gridHeight);
      expect(state.cellSize).toBeCloseTo(minCell, 5);
    });

    it('should fill the canvas after center', () => {
      const map = new GameMap(container);
      map.pan(-200, -150);
      map.center();
      assertFillsCanvas(map, 800, 600);
    });
  });

  // ─── zoom ───────────────────────────────────────────────────────────────────

  describe('zoom', () => {
    it('zoomIn should increase cellSize', () => {
      const map = new GameMap(container);
      const before = map.getState().cellSize;
      map.zoomIn(0.1);
      expect(map.getState().cellSize).toBeGreaterThan(before);
    });

    it('zoomOut should decrease or maintain cellSize', () => {
      const map = new GameMap(container);
      map.zoomIn(1); // zoom in first so there is room to zoom out
      const before = map.getState().cellSize;
      map.zoomOut(0.1);
      expect(map.getState().cellSize).toBeLessThan(before);
    });

    it('zoomOut should not go below the minimum cell size', () => {
      const map = new GameMap(container);
      map.zoomOut(100); // extreme zoom-out
      const minCell = Math.max(800 / map.gridWidth, 600 / map.gridHeight);
      expect(map.getState().cellSize).toBeGreaterThanOrEqual(minCell - FLOAT_TOLERANCE);
    });
  });

  // ─── resize ─────────────────────────────────────────────────────────────────

  describe('resize', () => {
    it('should not throw when called with new dimensions', () => {
      const map = new GameMap(container);
      expect(() => map.resize(1024, 768)).not.toThrow();
    });

    it('should update the canvas dimensions', () => {
      const map = new GameMap(container);
      map.resize(1024, 768);
      // After resize, the fill-canvas invariant must hold for the new size
      assertFillsCanvas(map, 1024, 768);
    });
  });

  // ─── render ─────────────────────────────────────────────────────────────────

  describe('render', () => {
    it('should not throw when called explicitly', () => {
      const map = new GameMap(container);
      expect(() => map.render()).not.toThrow();
    });
  });

  // ─── dispose ────────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('should not throw when called', () => {
      const map = new GameMap(container);
      expect(() => map.dispose()).not.toThrow();
    });

    it('should remove the canvas from the container', () => {
      const map = new GameMap(container);
      expect(container.querySelector('canvas')).not.toBeNull();
      map.dispose();
      expect(container.querySelector('canvas')).toBeNull();
    });
  });

  // ─── getCellCoordinate ───────────────────────────────────────────────────────

  describe('view angle', () => {
    it('getTiltAngle should return 0 initially', () => {
      const map = new GameMap(container);
      expect(map.getTiltAngle()).toBe(0);
    });

    it('tiltView should not throw', () => {
      const map = new GameMap(container);
      expect(() => map.tiltView()).not.toThrow();
    });

    it('tiltView should accept a custom angle without throwing', () => {
      const map = new GameMap(container);
      expect(() => map.tiltView(Math.PI / 3)).not.toThrow();
    });

    it('topDownView should not throw', () => {
      const map = new GameMap(container);
      expect(() => map.topDownView()).not.toThrow();
    });

    it('topDownView after tiltView should not throw', () => {
      const map = new GameMap(container);
      map.tiltView();
      expect(() => map.topDownView()).not.toThrow();
    });

    it('calling tiltView twice should not throw (cancels prior animation)', () => {
      const map = new GameMap(container);
      map.tiltView();
      expect(() => map.tiltView(Math.PI / 6)).not.toThrow();
    });
  });

  describe('getCellCoordinate', () => {
    it('should return the correct world coordinate for a cell', () => {
      const map = new GameMap(container);
      const coord = map.getCellCoordinate(3, 5);
      expect(coord.x).toBe(3);
      expect(coord.y).toBe(5);
    });

    it('should return correct chunk coords via coordinate-system', () => {
      const map = new GameMap(container);
      // Cell (16, 16) is at the start of chunk (1,1) when CHUNK_SIZE=16
      const coord = map.getCellCoordinate(16, 16);
      expect(coord.chunk.cx).toBe(1);
      expect(coord.chunk.cy).toBe(1);
    });

    it('should return correct local coords via coordinate-system', () => {
      const map = new GameMap(container);
      const coord = map.getCellCoordinate(17, 3);
      // local x = 17 % 16 = 1, local y = 3 % 16 = 3
      expect(coord.local.lx).toBe(1);
      expect(coord.local.ly).toBe(3);
    });
  });

  // ─── setCellColor ────────────────────────────────────────────────────────────

  describe('setCellColor', () => {
    it('should not throw when setting a colour', () => {
      const map = new GameMap(container);
      expect(() => map.setCellColor(0, 0, 0xff0000)).not.toThrow();
    });

    it('should not throw when clearing a colour with null', () => {
      const map = new GameMap(container);
      map.setCellColor(0, 0, 0xff0000);
      expect(() => map.setCellColor(0, 0, null)).not.toThrow();
    });

    it('should allow setting different colours for different cells', () => {
      const map = new GameMap(container);
      expect(() => {
        map.setCellColor(0, 0, 0xff0000);
        map.setCellColor(1, 1, 0x00ff00);
        map.setCellColor(2, 2, 0x0000ff);
      }).not.toThrow();
    });

    it('should allow overwriting an existing colour', () => {
      const map = new GameMap(container);
      map.setCellColor(0, 0, 0xff0000);
      expect(() => map.setCellColor(0, 0, 0x00ff00)).not.toThrow();
    });

    it('clearing a cell that has no colour should not throw', () => {
      const map = new GameMap(container);
      expect(() => map.setCellColor(0, 0, null)).not.toThrow();
    });
  });

  // ─── onCellClick ─────────────────────────────────────────────────────────────

  describe('onCellClick', () => {
    it('should not throw when registering a callback', () => {
      const map = new GameMap(container);
      expect(() => map.onCellClick(() => { /* noop */ })).not.toThrow();
    });

    it('should not throw when passing null to remove a handler', () => {
      const map = new GameMap(container);
      map.onCellClick(() => { /* noop */ });
      expect(() => map.onCellClick(null)).not.toThrow();
    });

    it('should invoke the callback with col and row when the canvas is clicked', () => {
      const map = new GameMap(container, { gridWidth: 10, gridHeight: 10, cellSize: 80 });
      // canvas: 800x600, grid: 10x10 cells at 80px each = 800x800 (taller than canvas)
      // offsetX = 0, offsetY = −100 (grid top is 100px above canvas top)
      // Cell (1, 2) centre is at canvas (1*80+40, −100+2*80+40) = (120, 100)
      const calls: Array<{ col: number; row: number }> = [];
      map.onCellClick((col, row) => calls.push({ col, row }));

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        configurable: true,
      });
      canvas.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 100 }),
      );
      expect(calls.length).toBe(1);
      expect(calls[0].col).toBe(1);
      expect(calls[0].row).toBe(2);
    });

    it('should not invoke the callback when clicking outside the grid', () => {
      const map = new GameMap(container, { gridWidth: 5, gridHeight: 5, cellSize: 50 });
      const calls: Array<{ col: number; row: number }> = [];
      map.onCellClick((col, row) => calls.push({ col, row }));

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        configurable: true,
      });
      // Click far outside the 5x5 grid (col ~= 1600/50 which is >> 5)
      canvas.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 1600, clientY: 1600 }),
      );
      expect(calls.length).toBe(0);
    });

    it('should not invoke the callback when no handler is registered', () => {
      new GameMap(container);
      // No handler registered; clicking should be a no-op.
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        configurable: true,
      });
      expect(() =>
        canvas.dispatchEvent(
          new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }),
        ),
      ).not.toThrow();
    });
  });
});
