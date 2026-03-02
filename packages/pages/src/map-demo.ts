import { GameMap, MapController } from '@auto-game/ui-component';

const mapContainer = document.getElementById('map-container') as HTMLElement;
const controllerWrap = document.getElementById('controller-wrap') as HTMLElement;

// Initialise 168x168 map
const map = new GameMap(mapContainer, {
  gridWidth: 168,
  gridHeight: 168,
  cellSize: 1,
  gridColor: 0x555566,
  groundColor: 0x2a4a35,
});

// Attach controller
const ctrl = new MapController(controllerWrap, { panStep: 8, zoomStep: 0.1 });
ctrl.attachMap(map);

// Keep canvas filling the container on resize
window.addEventListener('resize', () => {
  map.resize(mapContainer.clientWidth, mapContainer.clientHeight);
});
