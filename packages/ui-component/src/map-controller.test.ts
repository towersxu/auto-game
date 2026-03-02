// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapController } from './map-controller';
import { GameMap } from './map';

// Minimal GameMap stub – no Three.js needed in controller tests
function makeMapStub(): GameMap {
  return {
    pan: vi.fn(),
    center: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getState: vi.fn(() => ({ offsetX: 0, offsetZ: 0, zoom: 1 })),
    render: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    gridWidth: 168,
    gridHeight: 168,
    cellSize: 1,
  } as unknown as GameMap;
}

function makeContainer(): HTMLElement {
  return document.createElement('div');
}

describe('MapController', () => {
  let container: HTMLElement;
  let map: GameMap;

  beforeEach(() => {
    container = makeContainer();
    map = makeMapStub();
  });

  describe('constructor', () => {
    it('should create a MapController instance', () => {
      const ctrl = new MapController(container);
      expect(ctrl).toBeInstanceOf(MapController);
    });

    it('should use default panStep of 10', () => {
      const ctrl = new MapController(container);
      expect(ctrl.panStep).toBe(10);
    });

    it('should use default zoomStep of 0.1', () => {
      const ctrl = new MapController(container);
      expect(ctrl.zoomStep).toBeCloseTo(0.1);
    });

    it('should accept custom panStep', () => {
      const ctrl = new MapController(container, { panStep: 20 });
      expect(ctrl.panStep).toBe(20);
    });

    it('should accept custom zoomStep', () => {
      const ctrl = new MapController(container, { zoomStep: 0.2 });
      expect(ctrl.zoomStep).toBeCloseTo(0.2);
    });

    it('should render 7 buttons', () => {
      new MapController(container);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(7);
    });
  });

  describe('button layout', () => {
    it('should have a Pan Up button', () => {
      new MapController(container);
      const btn = container.querySelector('[aria-label="Pan Up"]');
      expect(btn).not.toBeNull();
    });

    it('should have a Pan Left button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Pan Left"]')).not.toBeNull();
    });

    it('should have a Center button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Center"]')).not.toBeNull();
    });

    it('should have a Pan Right button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Pan Right"]')).not.toBeNull();
    });

    it('should have a Zoom In button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Zoom In"]')).not.toBeNull();
    });

    it('should have a Pan Down button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Pan Down"]')).not.toBeNull();
    });

    it('should have a Zoom Out button', () => {
      new MapController(container);
      expect(container.querySelector('[aria-label="Zoom Out"]')).not.toBeNull();
    });
  });

  describe('attachMap / detachMap', () => {
    it('should attach a map', () => {
      const ctrl = new MapController(container);
      ctrl.attachMap(map);
      // clicking Pan Up should call map.pan
      const btn = container.querySelector<HTMLButtonElement>('[aria-label="Pan Up"]')!;
      btn.click();
      expect(map.pan).toHaveBeenCalled();
    });

    it('should detach the map so buttons have no effect', () => {
      const ctrl = new MapController(container);
      ctrl.attachMap(map);
      ctrl.detachMap();
      const btn = container.querySelector<HTMLButtonElement>('[aria-label="Pan Up"]')!;
      btn.click();
      expect(map.pan).not.toHaveBeenCalled();
    });
  });

  describe('button actions', () => {
    beforeEach(() => {
      const ctrl = new MapController(container);
      ctrl.attachMap(map);
    });

    it('Pan Up should call map.pan with negative Z', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Pan Up"]')!.click();
      expect(map.pan).toHaveBeenCalledWith(0, -10);
    });

    it('Pan Down should call map.pan with positive Z', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Pan Down"]')!.click();
      expect(map.pan).toHaveBeenCalledWith(0, 10);
    });

    it('Pan Left should call map.pan with negative X', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Pan Left"]')!.click();
      expect(map.pan).toHaveBeenCalledWith(-10, 0);
    });

    it('Pan Right should call map.pan with positive X', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Pan Right"]')!.click();
      expect(map.pan).toHaveBeenCalledWith(10, 0);
    });

    it('Center should call map.center', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Center"]')!.click();
      expect(map.center).toHaveBeenCalled();
    });

    it('Zoom In should call map.zoomIn', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Zoom In"]')!.click();
      expect(map.zoomIn).toHaveBeenCalledWith(0.1);
    });

    it('Zoom Out should call map.zoomOut', () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Zoom Out"]')!.click();
      expect(map.zoomOut).toHaveBeenCalledWith(0.1);
    });
  });

  describe('getElement', () => {
    it('should return the container element', () => {
      const ctrl = new MapController(container);
      expect(ctrl.getElement()).toBe(container);
    });
  });

  describe('dispose', () => {
    it('should clear the container', () => {
      const ctrl = new MapController(container);
      ctrl.dispose();
      expect(container.innerHTML).toBe('');
    });

    it('should detach the map on dispose', () => {
      const ctrl = new MapController(container);
      ctrl.attachMap(map);
      ctrl.dispose();
      // After dispose the container is empty – re-querying finds nothing
      expect(container.querySelector('button')).toBeNull();
    });
  });

  describe('className option', () => {
    it('should apply custom className to wrapper', () => {
      new MapController(container, { className: 'my-ctrl' });
      expect(container.querySelector('.my-ctrl')).not.toBeNull();
    });

    it('should always have map-controller class', () => {
      new MapController(container);
      expect(container.querySelector('.map-controller')).not.toBeNull();
    });
  });
});
