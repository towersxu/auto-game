// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Three.js so tests run without a WebGL context ──────────────────────
vi.mock('three', () => {
  class FakeObject3D {
    position = { set: vi.fn(), x: 0, y: 0, z: 0 };
    rotation = { x: 0 };
    add = vi.fn();
  }
  class FakeScene extends FakeObject3D {
    background: unknown = null;
  }
  class FakeColor {
    constructor(_hex: number) {}
  }
  class FakeGeometry {
    dispose = vi.fn();
  }
  class FakeMaterial {
    dispose = vi.fn();
  }
  class FakeGridHelper extends FakeObject3D {}
  class FakeMesh extends FakeObject3D {
    geometry = new FakeGeometry();
    material = new FakeMaterial();
  }
  class FakeCamera {
    position = { set: vi.fn(), x: 0, y: 0, z: 0 };
    left = 0; right = 0; top = 0; bottom = 0;
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
  }
  class FakeRenderer {
    domElement = document.createElement('canvas') as HTMLCanvasElement;
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return {
    Scene: FakeScene,
    Color: FakeColor,
    PlaneGeometry: FakeGeometry,
    MeshBasicMaterial: FakeMaterial,
    Mesh: FakeMesh,
    GridHelper: FakeGridHelper,
    OrthographicCamera: FakeCamera,
    WebGLRenderer: FakeRenderer,
  };
});

import { GameMap, MapOptions } from './map';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  return el;
}

describe('GameMap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

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

    it('should accept custom cell size', () => {
      const map = new GameMap(container, { cellSize: 2 });
      expect(map.cellSize).toBe(2);
    });

    it('should use default cell size of 1', () => {
      const map = new GameMap(container);
      expect(map.cellSize).toBe(1);
    });

    it('should accept all MapOptions', () => {
      const opts: MapOptions = {
        gridWidth: 50,
        gridHeight: 50,
        cellSize: 1,
        gridColor: 0xffffff,
        groundColor: 0x123456,
      };
      const map = new GameMap(container, opts);
      expect(map.gridWidth).toBe(50);
    });
  });

  describe('getState', () => {
    it('should return initial state with zero offsets and zoom 1', () => {
      const map = new GameMap(container);
      const state = map.getState();
      expect(state.offsetX).toBe(0);
      expect(state.offsetZ).toBe(0);
      expect(state.zoom).toBe(1);
    });

    it('should return a copy of the state (not a reference)', () => {
      const map = new GameMap(container);
      const state1 = map.getState();
      const state2 = map.getState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('pan', () => {
    it('should update offsetX and offsetZ', () => {
      const map = new GameMap(container);
      map.pan(5, 3);
      const state = map.getState();
      expect(state.offsetX).toBe(5);
      expect(state.offsetZ).toBe(3);
    });

    it('should accumulate multiple pans', () => {
      const map = new GameMap(container);
      map.pan(5, 0);
      map.pan(-2, 4);
      const state = map.getState();
      expect(state.offsetX).toBe(3);
      expect(state.offsetZ).toBe(4);
    });

    it('should support negative deltas', () => {
      const map = new GameMap(container);
      map.pan(-10, -20);
      expect(map.getState().offsetX).toBe(-10);
      expect(map.getState().offsetZ).toBe(-20);
    });
  });

  describe('center', () => {
    it('should reset state to initial values', () => {
      const map = new GameMap(container);
      map.pan(100, 50);
      map.zoomIn(0.3);
      map.center();
      const state = map.getState();
      expect(state.offsetX).toBe(0);
      expect(state.offsetZ).toBe(0);
      expect(state.zoom).toBe(1);
    });
  });

  describe('zoom', () => {
    it('should decrease zoom when zooming in', () => {
      const map = new GameMap(container);
      map.zoomIn(0.1);
      expect(map.getState().zoom).toBeCloseTo(0.9);
    });

    it('should increase zoom when zooming out', () => {
      const map = new GameMap(container);
      map.zoomOut(0.1);
      expect(map.getState().zoom).toBeCloseTo(1.1);
    });

    it('should clamp zoom-in at minimum 0.1', () => {
      const map = new GameMap(container);
      map.zoomIn(100);
      expect(map.getState().zoom).toBe(0.1);
    });

    it('should clamp zoom-out at maximum 5', () => {
      const map = new GameMap(container);
      map.zoomOut(100);
      expect(map.getState().zoom).toBe(5);
    });
  });

  describe('resize', () => {
    it('should not throw when called with new dimensions', () => {
      const map = new GameMap(container);
      expect(() => map.resize(1024, 768)).not.toThrow();
    });
  });

  describe('render', () => {
    it('should not throw when called explicitly', () => {
      const map = new GameMap(container);
      expect(() => map.render()).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should not throw when called', () => {
      const map = new GameMap(container);
      expect(() => map.dispose()).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      const map = new GameMap(container);
      map.dispose();
      expect(() => map.dispose()).not.toThrow();
    });
  });
});
