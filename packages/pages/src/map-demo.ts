import { GameMap, MapController } from '@auto-game/ui-component';

const mapContainer = document.getElementById('map-container') as HTMLElement;
const controllerWrap = document.getElementById('controller-wrap') as HTMLElement;

// Initialise 168x168 map.
// cellSize is the initial cell size in pixels; the map auto-adjusts to fill the canvas.
const map = new GameMap(mapContainer, {
  gridWidth: 168,
  gridHeight: 168,
  cellSize: 10,
  gridColor: 0x555566,
  groundColor: 0x2a4a35,
});

// Attach controller
const ctrl = new MapController(controllerWrap, { panStep: 30, zoomStep: 0.15 });
ctrl.attachMap(map);

// Keep canvas filling the container on resize
window.addEventListener('resize', () => {
  map.resize(mapContainer.clientWidth, mapContainer.clientHeight);
});
